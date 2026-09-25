import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { callAI } from "@/lib/ai/provider";
import { buildGeneratePlanPrompt, summarizeWeeklyAdjustment } from "@/lib/ai/prompts";
import { generatedPlanSchema } from "@/lib/ai/schemas";
import { aiFailureResponse, enforceAIRateLimit } from "@/lib/ai/route-helpers";
import { fetchAITrainingContext } from "@/lib/services/ai-context";
import { enforceWeeklyPlanPreferences } from "@/lib/services/plan-constraints";
import { getSupabaseAdmin } from "@/lib/db/supabase";

export const POST = withApiAuth(async (request: NextRequest) => {
  const limited = enforceAIRateLimit(request, "generate-plan");
  if (limited) return limited;
  try {
    const context = await fetchAITrainingContext();
    const rawPlan = await callAI({ task: "generate-plan", prompt: buildGeneratePlanPrompt(context), schema: generatedPlanSchema });
    const plan = enforceWeeklyPlanPreferences(rawPlan, context.training_preferences, context.ranges.next_week.start);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("ai_suggestions").insert({
      suggestion_type: "generate-plan",
      input_summary: JSON.stringify({
        today: context.today,
        next_week: context.ranges.next_week,
        local_risk: context.local_risk,
        recent_execution_quality: context.dashboard_recent_execution_quality,
      }),
      suggestion_text: summarizeWeeklyAdjustment(plan),
      structured_plan: plan,
      risk_level: plan.risk_level,
      applied: false,
    }).select("*").single();
    if (error) throw new Error(`保存 AI 生成计划失败: ${error.message}`);
    return ok({ suggestion: data, plan }, "AI 训练计划已生成并保存，需手动应用后才会写入计划");
  } catch (error) {
    return aiFailureResponse(request, error);
  }
});
