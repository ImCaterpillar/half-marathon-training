import "server-only";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { addDays, endOfWeekSunday, getTodayDateInTimezone, startOfWeekMonday } from "@/lib/time";
import { fetchCurrentPhase, fetchDashboardData, fetchProfile, fetchWorkoutsWithLogs } from "@/lib/services/training-data";
import { evaluateTrainingRisk } from "@/lib/risk";
import { round1, toNumber } from "@/lib/format";
import { summarizeTrainingPreferences } from "@/lib/preferences";
import type { WorkoutLog } from "@/lib/types/training";

function sumCompletedKm(logs: WorkoutLog[]) {
  return round1(logs.filter((log) => log.completed).reduce((sum, log) => sum + toNumber(log.actual_distance_km), 0));
}

function completionRate(workouts: Array<{ log?: { completed: boolean } | null; date: string }>, today: string) {
  const due = workouts.filter((workout) => workout.date <= today);
  if (due.length === 0) return 0;
  return Math.round((due.filter((workout) => workout.log?.completed).length / due.length) * 100);
}

export async function fetchAITrainingContext(today = getTodayDateInTimezone()) {
  const supabase = getSupabaseAdmin();
  const recent7Start = addDays(today, -6);
  const recent14Start = addDays(today, -13);
  const recent28Start = addDays(today, -27);
  const weekStart = startOfWeekMonday(today);
  const weekEnd = endOfWeekSunday(today);
  const previousWeekStart = addDays(weekStart, -7);
  const previousWeekEnd = addDays(weekStart, -1);
  const nextWeekStart = addDays(weekStart, 7);
  const nextWeekEnd = endOfWeekSunday(nextWeekStart);

  const [profile, currentPhase, dashboard, todayWorkouts, recent7Workouts, recent14Workouts, recent28Workouts, thisWeekWorkouts, nextWeekExistingWorkouts] = await Promise.all([
    fetchProfile(),
    fetchCurrentPhase(today),
    fetchDashboardData(today),
    fetchWorkoutsWithLogs(today, today),
    fetchWorkoutsWithLogs(recent7Start, today),
    fetchWorkoutsWithLogs(recent14Start, today),
    fetchWorkoutsWithLogs(recent28Start, today),
    fetchWorkoutsWithLogs(weekStart, weekEnd),
    fetchWorkoutsWithLogs(nextWeekStart, nextWeekEnd),
  ]);

  const { data: previousWeekLogs, error: previousWeekError } = await supabase
    .from("workout_logs")
    .select("*, workouts(id,title,workout_type,planned_rpe,planned_distance_km)")
    .gte("date", previousWeekStart)
    .lte("date", previousWeekEnd);
  if (previousWeekError) throw new Error(`读取上周训练日志失败: ${previousWeekError.message}`);

  const { data: testResults, error: testError } = await supabase
    .from("test_results")
    .select("*")
    .order("test_date", { ascending: false })
    .limit(10);
  if (testError) throw new Error(`读取测试成绩失败: ${testError.message}`);

  const { data: bodyMetrics, error: bodyError } = await supabase
    .from("body_metrics")
    .select("*")
    .gte("date", recent28Start)
    .lte("date", today)
    .order("date", { ascending: false });
  if (bodyError) throw new Error(`读取身体恢复数据失败: ${bodyError.message}`);

  const recent7Logs = recent7Workouts.map((workout) => workout.log).filter((log): log is WorkoutLog => Boolean(log));
  const recent14Logs = recent14Workouts.map((workout) => workout.log).filter((log): log is WorkoutLog => Boolean(log));
  const thisWeekLogs = thisWeekWorkouts.map((workout) => workout.log).filter((log): log is WorkoutLog => Boolean(log));
  const plannedWeeklyMileage = round1(thisWeekWorkouts.reduce((sum, workout) => sum + toNumber(workout.planned_distance_km), 0));
  const actualWeeklyMileage = sumCompletedKm(thisWeekLogs);
  const previousWeeklyMileage = sumCompletedKm(previousWeekLogs ?? []);

  const localRisk = evaluateTrainingRisk({
    recent7Logs,
    recent14Logs,
    plannedWeeklyMileage,
    actualWeeklyMileage,
    previousWeeklyMileage,
  });

  return {
    generated_at: new Date().toISOString(),
    timezone: "Asia/Shanghai",
    today,
    target: {
      goal_time_text: profile?.goal_time_text,
      goal_time_seconds: profile?.goal_time_seconds,
      goal_pace_text: profile?.goal_pace_text,
      goal_pace_seconds_per_km: profile?.goal_pace_seconds_per_km,
      current_pb_text: profile?.current_pb_text,
      current_pb_seconds: profile?.current_pb_seconds,
      target_race_name: profile?.target_race_name,
      target_race_date: profile?.target_race_date,
      note: profile?.target_race_date ? undefined : "目标比赛日期暂未设置；长期规划可暂按年底 12 月 31 日作为临时终点，并需明确说明。",
    },
    profile,
    current_phase: currentPhase,
    dashboard_summary: dashboard.stats,
    dashboard_today_brief: dashboard.today_brief,
    dashboard_weekly_summary: dashboard.weekly_summary,
    dashboard_recent_execution_quality: dashboard.recent_execution_quality,
    body_summary: dashboard.body,
    training_preferences: dashboard.training_preferences,
    training_preferences_summary: summarizeTrainingPreferences(dashboard.training_preferences),
    local_risk: localRisk,
    ranges: {
      recent_7_days: { start: recent7Start, end: today, completion_rate: completionRate(recent7Workouts, today), actual_km: sumCompletedKm(recent7Logs) },
      recent_14_days: { start: recent14Start, end: today, actual_km: sumCompletedKm(recent14Logs) },
      recent_28_days: { start: recent28Start, end: today },
      this_week: { start: weekStart, end: weekEnd, planned_km: plannedWeeklyMileage, actual_km: actualWeeklyMileage },
      previous_week: { start: previousWeekStart, end: previousWeekEnd, actual_km: previousWeeklyMileage },
      next_week: { start: nextWeekStart, end: nextWeekEnd },
    },
    today_workouts: todayWorkouts,
    recent_7_workouts: recent7Workouts,
    recent_14_workouts: recent14Workouts,
    recent_28_workouts: recent28Workouts,
    next_week_existing_workouts: nextWeekExistingWorkouts,
    recent_body_metrics: bodyMetrics ?? [],
    recent_test_results: testResults ?? [],
  };
}
