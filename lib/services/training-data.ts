import "server-only";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import type { DbTable } from "@/lib/db/database";
import { normalizeTrainingPreferences, summarizeTrainingPreferences } from "@/lib/preferences";
import { addDays, endOfMonth, endOfWeekSunday, getTodayDateInTimezone, startOfMonth, startOfWeekMonday } from "@/lib/time";
import { percent, round1, toNumber } from "@/lib/format";
import type {
  AppSettings,
  BodySummary,
  DashboardData,
  ExecutionQualitySummary,
  GoalSummary,
  PlanVersionSummary,
  Profile,
  RecentPlanAdjustmentSummary,
  ReadinessSummary,
  RiskResult,
  TodayBrief,
  TrainingPhase,
  WeeklySummary,
  Workout,
  WorkoutLog,
  WorkoutSummary,
  WorkoutWithLog,
} from "@/lib/types/training";
import { evaluateTrainingRisk } from "@/lib/risk";
import { buildVersionWorkoutChanges, buildWorkoutExecutionReview, enrichPlanVersionSummary, getWorkoutChangeKind } from "@/lib/services/plan-insights";

type WorkoutRow = DbTable<"workouts">;
type WorkoutLogRow = DbTable<"workout_logs">;
type ProfileRow = DbTable<"profile">;
type PhaseRow = DbTable<"training_phases">;
type AppSettingsRow = DbTable<"app_settings">;
type AiSuggestionSummaryRow = Pick<DbTable<"ai_suggestions">, "suggestion_text" | "risk_level" | "created_at">;
type PlanVersionRow = DbTable<"plan_versions">;

function extractConstraintReasons(notes: string | null | undefined) {
  if (!notes) return [];
  return notes
    .split("|")
    .map((item) => item.trim())
    .filter((item) =>
      item.includes("已按") ||
      item.includes("自动缩减") ||
      item.includes("高质量课") ||
      item.includes("长距离训练") ||
      item.includes("徒手版本") ||
      item.includes("恢复安排")
    );
}

function normalizeWorkout(row: WorkoutRow): Workout {
  const constraintReasons = extractConstraintReasons(row.notes);
  return {
    ...row,
    planned_distance_km: toNumber(row.planned_distance_km),
    planned_duration_min: toNumber(row.planned_duration_min),
    planned_pace_seconds_per_km: row.planned_pace_seconds_per_km === null ? null : toNumber(row.planned_pace_seconds_per_km),
    planned_rpe: row.planned_rpe === null ? null : toNumber(row.planned_rpe),
    constraint_reasons: constraintReasons,
    is_preference_adjusted: constraintReasons.length > 0,
  };
}

function normalizeWorkoutSummary(row: WorkoutRow): WorkoutSummary {
  return {
    id: row.id,
    title: row.title,
    planned_rpe: row.planned_rpe === null ? null : toNumber(row.planned_rpe),
    planned_distance_km: toNumber(row.planned_distance_km),
    workout_type: row.workout_type,
  };
}

type WorkoutLogJoinedRow = WorkoutLogRow & {
  workouts?: Pick<WorkoutRow, "id" | "title" | "planned_rpe" | "planned_distance_km" | "workout_type"> | null;
};

function normalizeLog(row: WorkoutLogJoinedRow): WorkoutLog {
  return {
    ...row,
    actual_distance_km: toNumber(row.actual_distance_km),
    actual_duration_seconds: toNumber(row.actual_duration_seconds),
    actual_pace_seconds_per_km: row.actual_pace_seconds_per_km === null ? null : toNumber(row.actual_pace_seconds_per_km),
    rpe: row.rpe === null ? null : toNumber(row.rpe),
    sleep_hours: row.sleep_hours === null ? null : toNumber(row.sleep_hours),
    body_weight_kg: row.body_weight_kg === null ? null : toNumber(row.body_weight_kg),
    fatigue_level: row.fatigue_level === null ? null : toNumber(row.fatigue_level),
    pain_score: row.pain_score === null ? null : toNumber(row.pain_score),
    workouts: row.workouts
      ? {
          id: row.workouts.id,
          title: row.workouts.title,
          planned_rpe: row.workouts.planned_rpe === null ? null : toNumber(row.workouts.planned_rpe),
          planned_distance_km: toNumber(row.workouts.planned_distance_km),
          workout_type: row.workouts.workout_type,
        }
      : null,
  };
}

function normalizeProfile(row: ProfileRow): Profile {
  return {
    ...row,
    age: toNumber(row.age),
    height_cm: toNumber(row.height_cm),
    current_weight_kg: toNumber(row.current_weight_kg),
    target_weight_min_kg: toNumber(row.target_weight_min_kg),
    target_weight_max_kg: toNumber(row.target_weight_max_kg),
    current_pb_seconds: toNumber(row.current_pb_seconds),
    goal_time_seconds: toNumber(row.goal_time_seconds),
    goal_pace_seconds_per_km: toNumber(row.goal_pace_seconds_per_km),
    max_training_days: toNumber(row.max_training_days),
  };
}

function normalizePhase(row: PhaseRow): TrainingPhase {
  return {
    ...row,
    weekly_mileage_min: toNumber(row.weekly_mileage_min),
    weekly_mileage_max: toNumber(row.weekly_mileage_max),
    training_days: toNumber(row.training_days),
  };
}

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function parseVersionSummary(row: PlanVersionRow) {
  const afterData = asObject(row.after_data);
  return enrichPlanVersionSummary(
    {
      id: row.id,
      version_name: row.version_name,
      change_reason: row.change_reason,
      change_type: row.change_type,
      target_table: row.target_table,
      created_by: row.created_by,
      created_at: row.created_at,
      source_suggestion_id: typeof afterData?.source_suggestion_id === "string" ? afterData.source_suggestion_id : null,
      source_suggestion_type: typeof afterData?.source_suggestion_type === "string" ? afterData.source_suggestion_type : null,
      before_data: row.before_data,
      after_data: row.after_data,
    },
    row.before_data,
    row.after_data
  );
}

export function normalizeAppSettings(row: AppSettingsRow): AppSettings {
  return {
    ...row,
    training_preferences: normalizeTrainingPreferences(row.training_preferences),
  };
}

export function buildTodayBrief(input: {
  primaryWorkout: WorkoutWithLog | null;
  todayStatus: DashboardData["today_status"];
  risk: RiskResult;
  aiTodayAdvice: string;
}): TodayBrief {
  const { primaryWorkout, todayStatus, risk, aiTodayAdvice } = input;
  if (!primaryWorkout) {
    return {
      status: "empty",
      headline: "今天没有排定训练课",
      workout_title: "空白日 / 恢复日",
      workout_type: null,
      purpose: "让身体完成恢复，或按需要补充拉伸与散步。",
      focus: "如果近期疲劳偏高，优先恢复；如果状态很好，也不要临时加硬课。",
      caution: "空白日不建议随意补高强度。",
      recommendation: risk.should_modify_today ? "今天建议继续恢复，不临时追加跑步训练。" : "今天可作为恢复或整理日。",
      should_modify_today: risk.should_modify_today,
      modified_workout_label: null,
    };
  }

  const modifiedWorkoutLabel = risk.should_modify_today
    ? "建议改为恢复跑、交叉训练或完全休息"
    : null;

  return {
    status: todayStatus,
    headline: todayStatus === "completed" ? "今天的关键任务已经完成" : "今天的训练任务已经准备好",
    workout_title: primaryWorkout.title,
    workout_type: primaryWorkout.workout_type,
    purpose: primaryWorkout.purpose ?? "今天这堂课主要服务于当前阶段目标和整体训练连续性。",
    focus: primaryWorkout.main_set ?? primaryWorkout.planned_pace_text ?? "重点关注呼吸、动作稳定性和配速执行。",
    caution: risk.reasons[0] ?? "注意疲劳、睡眠和疼痛反馈，不要硬顶强度。",
    recommendation: risk.should_modify_today ? `${risk.recommended_action} AI：${aiTodayAdvice}` : aiTodayAdvice,
    should_modify_today: risk.should_modify_today,
    modified_workout_label: modifiedWorkoutLabel,
  };
}

export function buildReadinessSummary(body: BodySummary, risk: RiskResult): ReadinessSummary {
  let recommendation = "按计划训练。";
  if (risk.risk_level === "yellow") recommendation = "建议降低冲动配速，优先完成而不是刷表现。";
  if (risk.risk_level === "orange") recommendation = "建议改恢复跑或缩短训练量。";
  if (risk.risk_level === "red") recommendation = "建议暂停跑步训练，优先恢复。";

  return {
    sleep_hours: body.latest_sleep_hours,
    fatigue_level: body.latest_fatigue_level,
    pain_area: body.latest_pain_area,
    pain_score: body.latest_pain_score,
    weather_note: "天气上下文预留中；当前可先结合当天体感与温湿度自行微调。",
    recommendation,
  };
}

export function buildWeeklySummary(input: {
  weekWorkouts: WorkoutWithLog[];
  currentPhase: TrainingPhase | null;
  risk: RiskResult;
  preferenceSummary: string;
  today: string;
}): WeeklySummary {
  const { weekWorkouts, currentPhase, risk, preferenceSummary, today } = input;
  const nextKeyWorkout =
    weekWorkouts.find((workout) => workout.date >= today && /间歇|节奏|长距离|测试/.test(`${workout.workout_type} ${workout.title}`)) ??
    weekWorkouts.find((workout) => workout.date >= today) ??
    null;

  const due = weekWorkouts.filter((workout) => workout.date <= today);
  const completed = due.filter((workout) => workout.log?.completed || workout.completed).length;
  const completionTrend =
    due.length === 0
      ? "本周尚未进入执行窗口。"
      : `本周已完成 ${completed}/${due.length} 次计划训练，完成率 ${percent(completed, due.length)}%。`;

  return {
    next_key_workout: nextKeyWorkout ? `${nextKeyWorkout.date} · ${nextKeyWorkout.title}` : "本周后续没有排定关键课。",
    completion_trend: completionTrend,
    risk_explanation: `${currentPhase?.phase_name ?? "当前阶段"}：${risk.recommended_action} 触发原因：${risk.reasons.join("；")}`,
    preference_summary: preferenceSummary,
  };
}

export function buildRecentExecutionQualitySummary(workouts: WorkoutWithLog[]): ExecutionQualitySummary {
  const completed = workouts.filter((workout) => workout.log?.completed);
  const counts = {
    on_target: 0,
    completed_hard: 0,
    shortened: 0,
    overreached: 0,
  };

  if (completed.length === 0) {
    return {
      quality_score: 0,
      dominant_status: "insufficient_data",
      headline: "Not enough completed sessions yet",
      summary: "Once you log a few sessions, the dashboard will summarize whether recent workouts are landing on target or drifting off plan.",
      recommendation: "Keep logging workouts with distance, time, and effort so the execution quality trend can stabilize.",
      counts,
    };
  }

  const scoreMap = {
    on_target: 100,
    completed_hard: 72,
    shortened: 45,
    overreached: 30,
  } as const;

  let scoreTotal = 0;
  for (const workout of completed) {
    const review = buildWorkoutExecutionReview(workout);
    if (!review || review.status === "no_log") continue;
    counts[review.status] += 1;
    scoreTotal += scoreMap[review.status];
  }

  const executedCount = counts.on_target + counts.completed_hard + counts.shortened + counts.overreached;
  if (executedCount === 0) {
    return {
      quality_score: 0,
      dominant_status: "insufficient_data",
      headline: "Not enough complete review data yet",
      summary: "Recent workouts were logged, but there is not enough pace, volume, or effort detail to judge execution quality.",
      recommendation: "Capture full workout logs so the coach view can judge whether you are matching the intended load.",
      counts,
    };
  }

  const qualityScore = Math.round(scoreTotal / executedCount);
  const dominantStatus =
    Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as keyof typeof counts;

  let headline = "Recent execution looks stable";
  let summary = `In the last 7 days, ${counts.on_target} workout(s) landed close to plan.`;
  let recommendation = "You can keep progressing as planned if recovery markers stay stable.";
  let dominant: ExecutionQualitySummary["dominant_status"] = "stable";

  if (dominantStatus === "completed_hard") {
    dominant = "completed_hard";
    headline = "Recent workouts are getting done, but at a higher cost";
    summary = `You finished ${counts.completed_hard} recent workout(s) with effort higher than intended, which can quietly accumulate fatigue.`;
    recommendation = "Keep the next key session only if sleep, soreness, and fatigue settle back down.";
  } else if (dominantStatus === "shortened") {
    dominant = "shortened";
    headline = "Recent sessions are trending short of plan";
    summary = `You have ${counts.shortened} shortened workout(s) in the last 7 days, which suggests the current load may be hard to absorb or schedule.`;
    recommendation = "Avoid compensating with extra volume. Let the next week re-balance the load instead.";
  } else if (dominantStatus === "overreached") {
    dominant = "overreached";
    headline = "You have been pushing recent sessions beyond the target";
    summary = `There were ${counts.overreached} overreached workout(s) in the last 7 days, which raises the chance of fatigue carrying into the next key day.`;
    recommendation = "Prioritize recovery and resist adding pace or distance unless the plan specifically asks for it.";
  } else if (counts.completed_hard > 0 || counts.overreached > 0) {
    summary = `Most sessions are close to plan, but ${counts.completed_hard + counts.overreached} workout(s) still ran harder than intended.`;
    recommendation = "Stay disciplined on easy and steady days so the hard work remains targeted instead of constant.";
  }

  return {
    quality_score: qualityScore,
    dominant_status: dominant,
    headline,
    summary,
    recommendation,
    counts,
  };
}

export function buildRecentPlanAdjustmentSummary(versions: PlanVersionSummary[]): RecentPlanAdjustmentSummary {
  for (const version of versions) {
    const firstKeyChange = buildVersionWorkoutChanges(version).find((change) => getWorkoutChangeKind(change) !== "adjusted");
    if (firstKeyChange) {
      const kind = getWorkoutChangeKind(firstKeyChange) as Exclude<RecentPlanAdjustmentSummary["kind"], "none">;
      const labelMap = {
        moved: "Moved",
        resized: "Resized",
        guardrail: "Guardrail",
        adjusted: "Adjusted",
      } satisfies Record<Exclude<RecentPlanAdjustmentSummary["kind"], "none">, string>;
      return {
        kind,
        label: labelMap[kind],
        version_id: version.id,
        version_name: version.version_name,
        created_at: version.created_at,
        summary: version.impact_summary ?? "Recent plan adjustment detected.",
        detail: firstKeyChange.changes[0] ?? firstKeyChange.triggers[0] ?? version.change_reason ?? "Recent plan adjustment detected.",
      };
    }
  }

  const latestVersion = versions[0] ?? null;
  if (latestVersion) {
    return {
      kind: "adjusted",
      label: "Adjusted",
      version_id: latestVersion.id,
      version_name: latestVersion.version_name,
      created_at: latestVersion.created_at,
      summary: latestVersion.impact_summary ?? "Recent plan adjustment detected.",
      detail: latestVersion.highlights?.[0] ?? latestVersion.change_reason ?? "Recent plan adjustment detected.",
    };
  }

  return {
    kind: "none",
    label: "No recent adjustment",
    version_id: null,
    version_name: null,
    created_at: null,
    summary: "No recent plan adjustment was found.",
    detail: "Recent AI, import, and manual changes will appear here.",
  };
}

export async function fetchProfile() {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase.from("profile").select("*").limit(1).maybeSingle();
  if (error) throw new Error(`读取个人资料失败: ${error.message}`);
  if (!data) return null;
  return normalizeProfile(data);
}

export async function fetchAppSettings() {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
  if (error) throw new Error(`读取应用设置失败: ${error.message}`);
  return data ? normalizeAppSettings(data) : null;
}

export async function fetchCurrentPhase(today = getTodayDateInTimezone()) {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("training_phases")
    .select("*")
    .lte("start_date", today)
    .gte("end_date", today)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`读取当前训练阶段失败: ${error.message}`);
  if (data) return normalizePhase(data);

  const fallback = await supabase
    .from("training_phases")
    .select("*")
    .gte("end_date", today)
    .order("start_date", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (fallback.error) throw new Error(`读取训练阶段失败: ${fallback.error.message}`);
  return fallback.data ? normalizePhase(fallback.data) : null;
}

export async function fetchWorkoutsWithLogs(start: string, end: string) {
  const supabase = getSupabaseAdmin() as any;
  const { data: workouts, error: workoutError } = await supabase
    .from("workouts")
    .select("*")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: true })
    .order("created_at", { ascending: true });
  if (workoutError) throw new Error(`读取训练计划失败: ${workoutError.message}`);

  const workoutRows = (workouts ?? []) as WorkoutRow[];
  const ids = workoutRows.map((workout) => workout.id);
  const logsByWorkoutId = new Map<string, WorkoutLog>();

  if (ids.length > 0) {
    const { data: logs, error: logError } = await supabase
      .from("workout_logs")
      .select("*")
      .in("workout_id", ids);
    if (logError) throw new Error(`读取训练打卡失败: ${logError.message}`);
    for (const log of (logs ?? []) as WorkoutLogJoinedRow[]) logsByWorkoutId.set(log.workout_id, normalizeLog(log));
  }

  return workoutRows.map((workout) => ({
    ...normalizeWorkout(workout),
    log: logsByWorkoutId.get(workout.id) ?? null,
  }));
}

export async function fetchLogs(start: string, end: string) {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("workout_logs")
    .select("*, workouts(id,title,planned_rpe,planned_distance_km,workout_type)")
    .gte("date", start)
    .lte("date", end)
    .order("date", { ascending: false });
  if (error) throw new Error(`读取训练日志失败: ${error.message}`);
  return ((data ?? []) as WorkoutLogJoinedRow[]).map((row: WorkoutLogJoinedRow) => normalizeLog(row));
}

function buildGoalSummary(profile: Profile | null, today: string): GoalSummary {
  const countdown = profile?.target_race_date
    ? Math.max(0, Math.ceil((new Date(profile.target_race_date).getTime() - new Date(today).getTime()) / 86_400_000))
    : null;

  return {
    target_race_name: profile?.target_race_name ?? null,
    target_race_date: profile?.target_race_date ?? null,
    countdown_days: countdown,
    countdown_text: countdown === null ? "目标比赛暂未设置" : `距离目标比赛 ${countdown} 天`,
    current_pb_text: profile?.current_pb_text ?? null,
    current_pb_seconds: profile?.current_pb_seconds ?? null,
    goal_time_text: profile?.goal_time_text ?? null,
    goal_time_seconds: profile?.goal_time_seconds ?? null,
    goal_pace_text: profile?.goal_pace_text ?? null,
    goal_pace_seconds_per_km: profile?.goal_pace_seconds_per_km ?? null,
  };
}

export async function fetchDashboardData(today = getTodayDateInTimezone()): Promise<DashboardData> {
  const supabase = getSupabaseAdmin() as any;
  const weekStart = startOfWeekMonday(today);
  const weekEnd = endOfWeekSunday(today);
  const previousWeekStart = addDays(weekStart, -7);
  const previousWeekEnd = addDays(weekStart, -1);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const recent7Start = addDays(today, -6);
  const recent14Start = addDays(today, -13);

  const [profile, appSettings, phase, todayWorkouts, weekWorkouts, monthWorkouts, recent7Workouts, recent14Logs, previousWeekLogs, recentVersionRows] = await Promise.all([
    fetchProfile(),
    fetchAppSettings(),
    fetchCurrentPhase(today),
    fetchWorkoutsWithLogs(today, today),
    fetchWorkoutsWithLogs(weekStart, weekEnd),
    fetchWorkoutsWithLogs(monthStart, monthEnd),
    fetchWorkoutsWithLogs(recent7Start, today),
    fetchLogs(recent14Start, today),
    fetchLogs(previousWeekStart, previousWeekEnd),
    supabase.from("plan_versions").select("*").order("created_at", { ascending: false }).limit(8),
  ]);

  const completedWeekLogs = weekWorkouts.map((workout) => workout.log).filter((log): log is WorkoutLog => Boolean(log && log.completed));
  const completedMonthLogs = monthWorkouts.map((workout) => workout.log).filter((log): log is WorkoutLog => Boolean(log && log.completed));
  const completedRecent7 = recent7Workouts.filter((workout) => workout.log?.completed).length;
  const plannedRecent7 = recent7Workouts.filter((workout) => workout.date <= today).length;
  const weeklyMileage = round1(completedWeekLogs.reduce((sum, log) => sum + toNumber(log.actual_distance_km), 0));
  const monthlyMileage = round1(completedMonthLogs.reduce((sum, log) => sum + toNumber(log.actual_distance_km), 0));
  const plannedWeeklyMileage = round1(weekWorkouts.reduce((sum, workout) => sum + toNumber(workout.planned_distance_km), 0));
  const previousWeeklyMileage = round1(previousWeekLogs.filter((log) => log.completed).reduce((sum, log) => sum + toNumber(log.actual_distance_km), 0));
  const trainingDaysThisWeek = new Set(completedWeekLogs.map((log) => log.date)).size;
  const latestLog = [...recent14Logs].sort((a, b) => b.date.localeCompare(a.date) || String(b.updated_at ?? "").localeCompare(String(a.updated_at ?? "")))[0] ?? null;
  const currentWeight = latestLog?.body_weight_kg ?? profile?.current_weight_kg ?? null;
  const risk = evaluateTrainingRisk({
    recent7Logs: recent14Logs.filter((log) => log.date >= recent7Start),
    recent14Logs,
    plannedWeeklyMileage,
    actualWeeklyMileage: weeklyMileage,
    previousWeeklyMileage,
  });

  const todayCompleted = todayWorkouts.length > 0 && todayWorkouts.every((workout) => workout.completed || workout.log?.completed);
  const todaySkipped = todayWorkouts.length > 0 && todayWorkouts.every((workout) => workout.skipped || workout.log?.completed === false);

  const { data: latestAiSuggestion, error: aiSuggestionError } = await supabase
    .from("ai_suggestions")
    .select("suggestion_text,risk_level,created_at")
    .eq("suggestion_type", "daily-advice")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (aiSuggestionError) throw new Error(`读取最新 AI 建议失败: ${aiSuggestionError.message}`);

  const stats = {
    weekly_mileage_km: weeklyMileage,
    planned_weekly_mileage_km: plannedWeeklyMileage,
    monthly_mileage_km: monthlyMileage,
    weekly_training_days: trainingDaysThisWeek,
    recent_7_day_completion_rate: percent(completedRecent7, plannedRecent7),
    recent_7_day_completed_count: completedRecent7,
    recent_7_day_planned_count: plannedRecent7,
  };

  const body: BodySummary = {
    current_weight_kg: currentWeight,
    target_weight_min_kg: profile?.target_weight_min_kg ?? null,
    target_weight_max_kg: profile?.target_weight_max_kg ?? null,
    latest_sleep_hours: latestLog?.sleep_hours ?? null,
    latest_fatigue_level: latestLog?.fatigue_level ?? null,
    latest_pain_area: latestLog?.pain_area ?? null,
    latest_pain_score: latestLog?.pain_score ?? null,
  };

  const goal = buildGoalSummary(profile, today);
  const aiTodayAdvice = (latestAiSuggestion as AiSuggestionSummaryRow | null)?.suggestion_text ?? "暂无 AI 今日建议；可到 AI 教练页面生成，基础打卡和统计不依赖 AI。";
  const training_preferences = appSettings?.training_preferences ?? normalizeTrainingPreferences(null);
  const today_status: DashboardData["today_status"] = todayWorkouts.length === 0 ? "empty" : todayCompleted ? "completed" : todaySkipped ? "skipped" : "pending";
  const primaryWorkout = todayWorkouts[0] ?? null;
  const preferenceSummary = summarizeTrainingPreferences(training_preferences);
  const recentExecutionQuality = buildRecentExecutionQualitySummary(recent7Workouts);
  if (recentVersionRows.error) throw new Error(`Failed to load recent plan adjustments: ${recentVersionRows.error.message}`);
  const recentPlanAdjustment = buildRecentPlanAdjustmentSummary(((recentVersionRows.data ?? []) as PlanVersionRow[]).map(parseVersionSummary));

  return {
    today,
    profile,
    today_workouts: todayWorkouts,
    today_status,
    stats,
    current_phase: phase,
    body,
    goal,
    risk,
    ai_today_advice: aiTodayAdvice,
    training_preferences,
    today_brief: buildTodayBrief({ primaryWorkout, todayStatus: today_status, risk, aiTodayAdvice }),
    readiness: buildReadinessSummary(body, risk),
    weekly_summary: buildWeeklySummary({
      weekWorkouts,
      currentPhase: phase,
      risk,
      preferenceSummary,
      today,
    }),
    recent_execution_quality: recentExecutionQuality,
    recent_plan_adjustment: recentPlanAdjustment,
  };
}
