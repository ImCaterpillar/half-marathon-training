import type { DailyAdvice, PhaseReview, RiskAnalysis, WeeklyAdjustment } from "@/lib/ai/schemas";

export function buildDailyAdvicePrompt(context: unknown) {
  return `
请基于下面的真实训练上下文，生成今天的训练建议。
不要虚构打卡数据；没有数据时明确采用保守判断。
必须显式参考 training_preferences、today_brief、weekly_summary、recent_execution_quality 和 local_risk。
如果 recent_execution_quality 显示最近 7 天频繁出现 completed_hard 或 overreached，要把“最近执行成本偏高”当成今天是否降强度的重要依据，即使恢复风险还没有完全到红色。
如果建议修改训练，优先遵守每周训练天数、长跑日、高质量课日期和临时限制。

必须返回严格 JSON，结构如下：
{
  "summary": "今日建议一句话总结",
  "risk_level": "green | yellow | orange | red",
  "risk_reasons": ["原因1"],
  "recommendation": "照常训练 | 降低强度 | 改恢复跑 | 休息 | 改交叉训练",
  "workout_adjustment": {
    "should_modify_today": true,
    "new_workout_type": "恢复跑",
    "new_distance_km": 5,
    "new_rpe": 3,
    "new_notes": "降低强度，观察疼痛/疲劳变化"
  },
  "recovery_advice": ["建议1"],
  "nutrition_advice": ["建议1"]
}

上下文 JSON：
${JSON.stringify(context, null, 2)}
`.trim();
}

export function buildWeeklyAdjustmentPrompt(context: unknown) {
  return `
请基于下面的真实训练上下文，生成下周训练调整建议。
当前基础跑量偏低时必须保守，不安排高风险强度堆叠。
必须显式遵守 training_preferences：每周训练天数、长跑日、允许的高质量课日期、力量训练条件、时长/跑量容忍度与临时限制。
如果 recent_execution_quality 显示最近 7 天反复出现 completed_hard 或 overreached，要主动降低下周关键课密度或整体训练成本。
如果 recent_execution_quality 显示多次 shortened，要考虑时间容量或恢复能力不足，而不是简单把未完成训练量补回去。
如果约束冲突，要在 notes 里明确说明取舍。

必须返回严格 JSON，结构如下：
{
  "summary": "下周调整总结",
  "risk_level": "green | yellow | orange | red",
  "weekly_mileage_recommendation": {
    "planned_km": 32,
    "reason": "基于最近执行情况的原因"
  },
  "workouts": [
    {
      "date": "YYYY-MM-DD",
      "workout_type": "轻松跑",
      "title": "轻松跑 6km",
      "planned_distance_km": 6,
      "planned_duration_min": 42,
      "planned_pace_text": "7'00/km",
      "planned_pace_seconds_per_km": 420,
      "planned_rpe": 3,
      "purpose": "有氧恢复",
      "warmup": "动态热身 8 分钟",
      "main_set": "轻松跑 6km",
      "cooldown": "慢走和拉伸",
      "strength_training": false,
      "notes": "保持轻松，不追配速"
    }
  ],
  "notes": ["注意事项1"]
}

上下文 JSON：
${JSON.stringify(context, null, 2)}
`.trim();
}

export function buildPhaseReviewPrompt(context: unknown) {
  return `
请基于最近 4 周训练、测试成绩、睡眠、疲劳、疼痛、当前阶段、training_preferences、dashboard_weekly_summary 和 recent_execution_quality，判断是否可以进入下一训练阶段。
不要虚构测试成绩。
如果 recent_execution_quality 持续显示训练常常跑重、缩量或超量，要把这视为阶段推进判断的一部分，而不是只看单次测试成绩。

必须返回严格 JSON：
{
  "summary": "阶段评估总结",
  "risk_level": "green | yellow | orange | red",
  "can_enter_next_phase": false,
  "reasons": ["原因1"],
  "suggested_gate": "进入下一阶段前建议达到的门槛"
}

上下文 JSON：
${JSON.stringify(context, null, 2)}
`.trim();
}

export function buildRiskAnalysisPrompt(context: unknown) {
  return `
请基于真实训练上下文分析过度训练、跑量增长、睡眠不足、疲劳堆积、疼痛风险和长距离恢复情况。
AI 建议不是医疗诊断。
必须结合 training_preferences 和 recent_execution_quality，判断风险是否来自计划过载、约束冲突或执行偏差，而不是只看单次打卡。

必须返回严格 JSON：
{
  "summary": "风险分析总结",
  "risk_level": "green | yellow | orange | red",
  "risk_reasons": ["原因1"],
  "recommended_action": "建议动作",
  "should_modify_today": false
}

上下文 JSON：
${JSON.stringify(context, null, 2)}
`.trim();
}

export function buildGeneratePlanPrompt(context: unknown) {
  return buildWeeklyAdjustmentPrompt(context);
}

export function summarizeDailyAdvice(advice: DailyAdvice) {
  return `${advice.summary}｜建议：${advice.recommendation}｜风险：${advice.risk_level}`;
}

export function summarizeWeeklyAdjustment(adjustment: WeeklyAdjustment) {
  return `${adjustment.summary}｜建议下周跑量：${adjustment.weekly_mileage_recommendation.planned_km} km｜风险：${adjustment.risk_level}`;
}

export function summarizePhaseReview(review: PhaseReview) {
  return `${review.summary}｜能否进入下一阶段：${review.can_enter_next_phase ? "可以" : "暂不建议"}｜风险：${review.risk_level}`;
}

export function summarizeRiskAnalysis(analysis: RiskAnalysis) {
  return `${analysis.summary}｜风险：${analysis.risk_level}｜建议：${analysis.recommended_action}`;
}
