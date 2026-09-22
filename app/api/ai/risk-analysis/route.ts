import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { callAI } from "@/lib/ai/provider";
import { buildRiskAnalysisPrompt, summarizeRiskAnalysis } from "@/lib/ai/prompts";
import { riskAnalysisSchema } from "@/lib/ai/schemas";
import { aiFailureResponse, enforceAIRateLimit } from "@/lib/ai/route-helpers";
import { fetchAITrainingContext } from "@/lib/services/ai-context";
import { getSupabaseAdmin } from "@/lib/db/supabase";

export const POST = withApiAuth(async (request: NextRequest) => {
  const limited = enforceAIRateLimit(request, "risk-analysis");
  if (limited) return limited;
  try {
    const context = await fetchAITrainingContext();
    const analysis = await callAI({ task: "risk-analysis", prompt: buildRiskAnalysisPrompt(context), schema: riskAnalysisSchema });
    const supabase = getSupabaseAdmin() as any;
    const { data, error } = await supabase.from("ai_suggestions").insert({
      suggestion_type: "risk-analysis",
      input_summary: JSON.stringify({
        today: context.today,
        local_risk: context.local_risk,
        ranges: context.ranges,
        recent_execution_quality: context.dashboard_recent_execution_quality,
      }),
      suggestion_text: summarizeRiskAnalysis(analysis),
      structured_plan: analysis,
      risk_level: analysis.risk_level,
      applied: false,
    }).select("*").single();
    if (error) throw new Error(`保存 AI 风险分析失败: ${error.message}`);
    return ok({ suggestion: data, analysis }, "AI 风险分析已生成并保存");
  } catch (error) {
    return aiFailureResponse(request, error);
  }
});
