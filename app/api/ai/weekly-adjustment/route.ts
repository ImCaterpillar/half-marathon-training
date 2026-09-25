import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { callAI } from "@/lib/ai/provider";
import { buildWeeklyAdjustmentPrompt, summarizeWeeklyAdjustment } from "@/lib/ai/prompts";
import { weeklyAdjustmentSchema } from "@/lib/ai/schemas";
import { aiFailureResponse, enforceAIRateLimit } from "@/lib/ai/route-helpers";
import { fetchAITrainingContext } from "@/lib/services/ai-context";
import { enforceWeeklyPlanPreferences } from "@/lib/services/plan-constraints";
import { getSupabaseAdmin } from "@/lib/db/supabase";

export const POST = withApiAuth(async (request: NextRequest) => {
  const limited = enforceAIRateLimit(request, "weekly-adjustment");
  if (limited) return limited;

  try {
    const context = await fetchAITrainingContext();
    const adjustmentDraft = await callAI({
      task: "weekly-adjustment",
      prompt: buildWeeklyAdjustmentPrompt(context),
      schema: weeklyAdjustmentSchema,
    });
    const adjustment = enforceWeeklyPlanPreferences(
      adjustmentDraft,
      context.training_preferences,
      context.ranges.next_week.start
    );

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_suggestions")
      .insert({
        suggestion_type: "weekly-adjustment",
        input_summary: JSON.stringify({
          today: context.today,
          next_week: context.ranges.next_week,
          local_risk: context.local_risk,
          recent_execution_quality: context.dashboard_recent_execution_quality,
          recent_7_days: context.ranges.recent_7_days,
          this_week: context.ranges.this_week,
          existing_next_week_workouts: context.next_week_existing_workouts.length,
        }),
        suggestion_text: summarizeWeeklyAdjustment(adjustment),
        structured_plan: adjustment,
        risk_level: adjustment.risk_level,
        applied: false,
      })
      .select("*")
      .single();

    if (error) throw new Error(`保存 AI 周计划建议失败: ${error.message}`);
    return ok({ suggestion: data, adjustment }, "AI 周计划调整建议已生成并保存");
  } catch (error) {
    return aiFailureResponse(request, error);
  }
});
