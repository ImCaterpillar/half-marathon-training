import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { callAI } from "@/lib/ai/provider";
import { buildDailyAdvicePrompt, summarizeDailyAdvice } from "@/lib/ai/prompts";
import { dailyAdviceSchema } from "@/lib/ai/schemas";
import { aiFailureResponse, enforceAIRateLimit } from "@/lib/ai/route-helpers";
import { fetchAITrainingContext } from "@/lib/services/ai-context";
import { enforceDailyAdvicePreferences } from "@/lib/services/plan-constraints";
import { getSupabaseAdmin } from "@/lib/db/supabase";

export const POST = withApiAuth(async (request: NextRequest) => {
  const limited = enforceAIRateLimit(request, "daily-advice");
  if (limited) return limited;

  try {
    const context = await fetchAITrainingContext();
    const advice = await callAI({
      task: "daily-advice",
      prompt: buildDailyAdvicePrompt(context),
      schema: dailyAdviceSchema,
    });

    const structured = enforceDailyAdvicePreferences({
      ...advice,
      workout_adjustment: {
        ...advice.workout_adjustment,
        date: advice.workout_adjustment.date ?? context.today,
      },
    }, context.training_preferences, context.today);

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from("ai_suggestions")
      .insert({
        suggestion_type: "daily-advice",
        input_summary: JSON.stringify({
          today: context.today,
          local_risk: context.local_risk,
          recent_execution_quality: context.dashboard_recent_execution_quality,
          today_workouts_count: context.today_workouts.length,
          recent_7_days: context.ranges.recent_7_days,
          this_week: context.ranges.this_week,
        }),
        suggestion_text: summarizeDailyAdvice(structured),
        structured_plan: structured,
        risk_level: structured.risk_level,
        applied: false,
      })
      .select("*")
      .single();

    if (error) throw new Error(`保存 AI 今日建议失败: ${error.message}`);
    return ok({ suggestion: data, advice: structured }, "AI 今日建议已生成并保存");
  } catch (error) {
    return aiFailureResponse(request, error);
  }
});
