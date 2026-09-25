import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { callAI } from "@/lib/ai/provider";
import { buildPhaseReviewPrompt, summarizePhaseReview } from "@/lib/ai/prompts";
import { phaseReviewSchema } from "@/lib/ai/schemas";
import { aiFailureResponse, enforceAIRateLimit } from "@/lib/ai/route-helpers";
import { fetchAITrainingContext } from "@/lib/services/ai-context";
import { getSupabaseAdmin } from "@/lib/db/supabase";

export const POST = withApiAuth(async (request: NextRequest) => {
  const limited = enforceAIRateLimit(request, "phase-review");
  if (limited) return limited;
  try {
    const context = await fetchAITrainingContext();
    const review = await callAI({ task: "phase-review", prompt: buildPhaseReviewPrompt(context), schema: phaseReviewSchema });
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from("ai_suggestions").insert({
      suggestion_type: "phase-review",
      input_summary: JSON.stringify({
        today: context.today,
        current_phase: context.current_phase,
        ranges: context.ranges,
        recent_execution_quality: context.dashboard_recent_execution_quality,
      }),
      suggestion_text: summarizePhaseReview(review),
      structured_plan: review,
      risk_level: review.risk_level,
      applied: false,
    }).select("*").single();
    if (error) throw new Error(`保存 AI 阶段评估失败: ${error.message}`);
    return ok({ suggestion: data, review }, "AI 阶段评估已生成并保存");
  } catch (error) {
    return aiFailureResponse(request, error);
  }
});
