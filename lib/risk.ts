import type { RiskLevel, RiskResult, WorkoutLog } from "@/lib/types/training";
import { toNumber } from "@/lib/format";

type RiskInput = {
  recent7Logs: WorkoutLog[];
  recent14Logs: WorkoutLog[];
  plannedWeeklyMileage: number;
  actualWeeklyMileage: number;
  previousWeeklyMileage: number;
};

function sortByDateDesc<T extends { date: string }>(items: T[]) {
  return [...items].sort((a, b) => b.date.localeCompare(a.date));
}

function hasConsecutive(items: WorkoutLog[], predicate: (item: WorkoutLog) => boolean, count: number) {
  let streak = 0;
  for (const item of sortByDateDesc(items)) {
    if (predicate(item)) {
      streak += 1;
      if (streak >= count) return true;
    } else {
      streak = 0;
    }
  }
  return false;
}

function mileageGrowth(actualWeeklyMileage: number, previousWeeklyMileage: number) {
  if (previousWeeklyMileage <= 0) return actualWeeklyMileage > 0 ? 100 : 0;
  return ((actualWeeklyMileage - previousWeeklyMileage) / previousWeeklyMileage) * 100;
}

function pushUnique(reasons: string[], reason: string) {
  if (!reasons.includes(reason)) reasons.push(reason);
}

function rank(level: RiskLevel) {
  return { green: 0, yellow: 1, orange: 2, red: 3 }[level];
}

function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  return rank(a) >= rank(b) ? a : b;
}

export function evaluateTrainingRisk(input: RiskInput): RiskResult {
  const reasons: string[] = [];
  let riskLevel: RiskLevel = "green";
  const recent7 = sortByDateDesc(input.recent7Logs);
  const recent14 = sortByDateDesc(input.recent14Logs);
  const growth = mileageGrowth(input.actualWeeklyMileage, input.previousWeeklyMileage);

  const anyPainScoreRed = recent14.some((log) => toNumber(log.pain_score, 0) >= 6);
  const anyPainAffectsLikely = recent14.some((log) => {
    const notes = `${log.notes ?? ""} ${log.pain_area ?? ""}`;
    return /跑姿|跛|走路痛|无法跑|伤病|刺痛/.test(notes);
  });
  const threeUnfinished = hasConsecutive(recent14, (log) => !log.completed, 3);
  const multiDayVeryPoorSleep = hasConsecutive(recent14, (log) => log.sleep_hours !== null && Number(log.sleep_hours) < 5.5, 3);

  if (anyPainScoreRed) pushUnique(reasons, "出现疼痛评分 ≥6，疑似伤病风险较高。");
  if (anyPainAffectsLikely) pushUnique(reasons, "疼痛描述可能已影响跑姿或正常跑步。");
  if (threeUnfinished) pushUnique(reasons, "连续 3 次训练未完成。");
  if (multiDayVeryPoorSleep) pushUnique(reasons, "连续多天睡眠 <5.5 小时。");
  if (reasons.length > 0) riskLevel = "red";

  const threeHighFatigue = hasConsecutive(recent14, (log) => toNumber(log.fatigue_level, 0) >= 4, 3);
  const painTwoDays = hasConsecutive(recent14, (log) => toNumber(log.pain_score, 0) > 0 || Boolean(log.pain_area), 2);
  const longRunPain = recent14.some((log) => toNumber(log.actual_distance_km, 0) >= 8 && toNumber(log.pain_score, 0) > 0);
  const hardSessionRecoveryBad = recent14.some((log) => toNumber(log.rpe, 0) >= 7 && (toNumber(log.fatigue_level, 0) >= 4 || toNumber(log.sleep_hours, 24) < 6));

  if (threeHighFatigue) {
    riskLevel = maxLevel(riskLevel, "orange");
    pushUnique(reasons, "连续 3 天疲劳 ≥4。");
  }
  if (painTwoDays) {
    riskLevel = maxLevel(riskLevel, "orange");
    pushUnique(reasons, "疼痛连续 2 天出现。");
  }
  if (growth > 20) {
    riskLevel = maxLevel(riskLevel, "orange");
    pushUnique(reasons, "本周跑量比上周增加 >20%。");
  }
  if (longRunPain) {
    riskLevel = maxLevel(riskLevel, "orange");
    pushUnique(reasons, "长距离后出现疼痛。");
  }
  if (hardSessionRecoveryBad) {
    riskLevel = maxLevel(riskLevel, "orange");
    pushUnique(reasons, "高强度课后恢复明显变差。");
  }

  const twoPoorSleep = hasConsecutive(recent7, (log) => log.sleep_hours !== null && Number(log.sleep_hours) < 6, 2);
  const twoHighFatigue = hasConsecutive(recent7, (log) => toNumber(log.fatigue_level, 0) >= 4, 2);
  const rpeHigherThanPlan = recent7.some((log) => {
    const plannedRpe = toNumber(log.workouts?.planned_rpe, 0);
    return plannedRpe > 0 && toNumber(log.rpe, 0) - plannedRpe >= 2;
  });

  if (twoPoorSleep) {
    riskLevel = maxLevel(riskLevel, "yellow");
    pushUnique(reasons, "连续 2 天睡眠 <6 小时。");
  }
  if (twoHighFatigue) {
    riskLevel = maxLevel(riskLevel, "yellow");
    pushUnique(reasons, "连续 2 天疲劳 ≥4。");
  }
  if (growth > 15) {
    riskLevel = maxLevel(riskLevel, "yellow");
    pushUnique(reasons, "本周跑量比上周增加 >15%。");
  }
  if (rpeHigherThanPlan) {
    riskLevel = maxLevel(riskLevel, "yellow");
    pushUnique(reasons, "单次训练 RPE 比计划高 2 级以上。");
  }

  if (riskLevel === "green") {
    const hasPain = recent7.some((log) => toNumber(log.pain_score, 0) > 0 || Boolean(log.pain_area));
    const latestTwo = recent7.slice(0, 2);
    const sleepOk = latestTwo.length === 0 || latestTwo.every((log) => log.sleep_hours === null || Number(log.sleep_hours) >= 6.5);
    const fatigueOk = latestTwo.length === 0 || latestTwo.every((log) => log.fatigue_level === null || Number(log.fatigue_level) <= 3);
    if (!hasPain && sleepOk && fatigueOk && growth <= 15) {
      pushUnique(reasons, "无疼痛，睡眠和疲劳记录未触发风险，跑量增长可控。");
    }
  }

  const recommendedAction: Record<RiskLevel, string> = {
    green: "可以按计划训练，继续保持低强度优先。",
    yellow: "建议保守执行计划，必要时降低强度或减少距离。",
    orange: "建议改为恢复跑、交叉训练或休息，并观察疼痛和疲劳。",
    red: "建议停止跑步训练，优先恢复；持续疼痛请咨询专业人士。",
  };

  return {
    risk_level: riskLevel,
    reasons,
    recommended_action: recommendedAction[riskLevel],
    should_modify_today: riskLevel === "orange" || riskLevel === "red",
  };
}
