import { NextRequest } from "next/server";
import type { DailyAdvice, WeeklyAdjustment } from "@/lib/ai/schemas";
import { dailyAdviceSchema, weeklyAdjustmentSchema } from "@/lib/ai/schemas";
import { fail, ok } from "@/lib/api/response";
import { enforceAIRateLimit } from "@/lib/ai/route-helpers";
import { withApiAuth } from "@/lib/auth/api-auth";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import type { Json } from "@/lib/db/database";
import { fetchAITrainingContext } from "@/lib/services/ai-context";
import { enforceDailyAdvicePreferences, enforceWeeklyPlanPreferences } from "@/lib/services/plan-constraints";
import type { ExecutionQualitySummary } from "@/lib/types/training";
import { applySuggestionSchema } from "@/lib/validation/ai";

type SuggestionRecord = {
  id: string;
  suggestion_type: string;
  applied: boolean;
  structured_plan: Json;
};

function buildExecutionQualityReason(executionQuality: ExecutionQualitySummary) {
  if (executionQuality.dominant_status === "insufficient_data") return null;
  return `Recent 7-day execution quality: ${executionQuality.headline} (${executionQuality.quality_score}/100).`;
}

function appendNote(existing: string | null | undefined, note: string) {
  return [existing, note].filter(Boolean).join(" | ");
}

function annotateWeeklyPlanWithExecutionQuality(plan: WeeklyAdjustment, executionQuality: ExecutionQualitySummary) {
  const reason = buildExecutionQualityReason(executionQuality);
  if (!reason) return plan;

  const note = `${reason} ${executionQuality.recommendation}`;
  return {
    ...plan,
    weekly_mileage_recommendation: {
      ...plan.weekly_mileage_recommendation,
      reason: `${plan.weekly_mileage_recommendation.reason} ${reason}`.trim(),
    },
    notes: [...plan.notes, note],
    workouts: plan.workouts.map((workout) => ({
      ...workout,
      notes: appendNote(workout.notes, note),
    })),
  };
}

function annotateDailyAdviceWithExecutionQuality(advice: DailyAdvice, executionQuality: ExecutionQualitySummary) {
  const reason = buildExecutionQualityReason(executionQuality);
  if (!reason || !advice.workout_adjustment.should_modify_today) return advice;

  return {
    ...advice,
    summary: `${advice.summary} ${reason}`.trim(),
    workout_adjustment: {
      ...advice.workout_adjustment,
      new_notes: appendNote(advice.workout_adjustment.new_notes, `${reason} ${executionQuality.recommendation}`),
    },
    recovery_advice: [...advice.recovery_advice, executionQuality.recommendation],
  };
}

function buildAppliedChangeReason(baseReason: string, executionQuality: ExecutionQualitySummary) {
  const reason = buildExecutionQualityReason(executionQuality);
  return reason ? `${baseReason} ${reason}` : baseReason;
}

export const POST = withApiAuth(async (request: NextRequest) => {
  const limited = enforceAIRateLimit(request, "apply-suggestion");
  if (limited) return limited;

  const input = applySuggestionSchema.parse(await request.json());
  const supabase = getSupabaseAdmin();

  const { data: suggestion, error: readError } = await supabase
    .from("ai_suggestions")
    .select("id, suggestion_type, applied, structured_plan")
    .eq("id", input.suggestion_id)
    .maybeSingle();

  if (readError) throw new Error(`Failed to load AI suggestion: ${readError.message}`);
  if (!suggestion) return fail("NOT_FOUND", "AI suggestion not found.", 404);

  const suggestionRecord = suggestion as SuggestionRecord;
  if (suggestionRecord.applied) return fail("ALREADY_APPLIED", "This AI suggestion was already applied.", 409);

  const context = await fetchAITrainingContext();
  let constrainedPlan = suggestionRecord.structured_plan;

  if (suggestionRecord.suggestion_type === "weekly-adjustment" || suggestionRecord.suggestion_type === "generate-plan") {
    constrainedPlan = annotateWeeklyPlanWithExecutionQuality(
      enforceWeeklyPlanPreferences(
        weeklyAdjustmentSchema.parse(suggestionRecord.structured_plan),
        context.training_preferences,
        context.ranges.next_week.start
      ),
      context.dashboard_recent_execution_quality
    );
  } else if (suggestionRecord.suggestion_type === "daily-advice") {
    constrainedPlan = annotateDailyAdviceWithExecutionQuality(
      enforceDailyAdvicePreferences(dailyAdviceSchema.parse(suggestionRecord.structured_plan), context.training_preferences, context.today),
      context.dashboard_recent_execution_quality
    );
  }

  await supabase.from("ai_suggestions").update({ structured_plan: constrainedPlan }).eq("id", input.suggestion_id);

  const finalChangeReason = buildAppliedChangeReason(
    input.change_reason ?? "User confirmed AI suggestion",
    context.dashboard_recent_execution_quality
  );

  const { data, error } = await supabase.rpc("apply_ai_suggestion", {
    p_suggestion_id: input.suggestion_id,
    p_change_reason: finalChangeReason,
  });

  if (error) {
    return fail("APPLY_AI_SUGGESTION_FAILED", `Applying the AI suggestion failed: ${error.message}`, 400);
  }

  return ok(data, "AI suggestion applied and linked to a backup version.");
});
