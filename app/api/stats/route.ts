import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbTable } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { percent, round1, toNumber } from "@/lib/format";
import { buildWorkoutExecutionReview } from "@/lib/services/plan-insights";
import { addDays, getTodayDateInTimezone, startOfMonth, startOfWeekMonday } from "@/lib/time";
import type { WorkoutWithLog } from "@/lib/types/training";

type WorkoutRow = DbTable<"workouts">;
type TestRow = DbTable<"test_results">;
type WorkoutLogJoinedRow = DbTable<"workout_logs"> & {
  workouts?:
    | Pick<
        WorkoutRow,
        | "id"
        | "date"
        | "week_number"
        | "workout_type"
        | "title"
        | "planned_distance_km"
        | "planned_duration_min"
        | "planned_pace_text"
        | "planned_pace_seconds_per_km"
        | "planned_rpe"
        | "purpose"
        | "warmup"
        | "main_set"
        | "cooldown"
        | "strength_training"
        | "notes"
        | "completed"
        | "skipped"
      >
    | null;
};

function addToMap(map: Map<string, number>, key: string, value: number) {
  map.set(key, round1((map.get(key) ?? 0) + value));
}

function mapToSeries(map: Map<string, number>, valueKey: string) {
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, [valueKey]: value }));
}

export const GET = withApiAuth(async (_request: NextRequest) => {
  const supabase = getSupabaseAdmin();
  const today = getTodayDateInTimezone();
  const start = addDays(today, -180);

  const [{ data: workouts, error: workoutError }, { data: logs, error: logError }, { data: tests, error: testError }] = await Promise.all([
    supabase.from("workouts").select("*").gte("date", start).lte("date", today).order("date", { ascending: true }),
    supabase
      .from("workout_logs")
      .select(
        "*, workouts(id,date,week_number,workout_type,title,planned_distance_km,planned_duration_min,planned_pace_text,planned_pace_seconds_per_km,planned_rpe,purpose,warmup,main_set,cooldown,strength_training,notes,completed,skipped)"
      )
      .gte("date", start)
      .lte("date", today)
      .order("date", { ascending: true }),
    supabase.from("test_results").select("*").order("test_date", { ascending: true }),
  ]);

  if (workoutError) throw new Error(`Failed to load workouts: ${workoutError.message}`);
  if (logError) throw new Error(`Failed to load workout logs: ${logError.message}`);
  if (testError) throw new Error(`Failed to load test results: ${testError.message}`);

  const workoutRows = (workouts ?? []) as WorkoutRow[];
  const logRows = (logs ?? []) as WorkoutLogJoinedRow[];
  const testRows = (tests ?? []) as TestRow[];
  const completedLogs = logRows.filter((log) => log.completed);
  const weeklyActual = new Map<string, number>();
  const monthlyActual = new Map<string, number>();
  const weeklyPlanned = new Map<string, number>();
  const monthlyPlanned = new Map<string, number>();
  const typeDistribution = new Map<string, number>();
  const typeMetrics = new Map<string, { count: number; distance: number; rpeTotal: number; rpeCount: number; paceTotal: number; paceCount: number }>();
  const completionQualitySummary = { on_target: 0, completed_hard: 0, shortened: 0, overreached: 0 };

  for (const workout of workoutRows) {
    addToMap(weeklyPlanned, startOfWeekMonday(workout.date), toNumber(workout.planned_distance_km));
    addToMap(monthlyPlanned, startOfMonth(workout.date), toNumber(workout.planned_distance_km));
  }

  for (const log of completedLogs) {
    const km = toNumber(log.actual_distance_km);
    const type = log.workouts?.workout_type ?? "unknown";
    addToMap(weeklyActual, startOfWeekMonday(log.date), km);
    addToMap(monthlyActual, startOfMonth(log.date), km);
    addToMap(typeDistribution, type, 1);

    const current = typeMetrics.get(type) ?? { count: 0, distance: 0, rpeTotal: 0, rpeCount: 0, paceTotal: 0, paceCount: 0 };
    current.count += 1;
    current.distance += km;
    if (log.rpe !== null) {
      current.rpeTotal += toNumber(log.rpe);
      current.rpeCount += 1;
    }
    if (log.actual_pace_seconds_per_km !== null) {
      current.paceTotal += toNumber(log.actual_pace_seconds_per_km);
      current.paceCount += 1;
    }
    typeMetrics.set(type, current);
  }

  const plannedPast = workoutRows.filter((workout) => workout.date <= today).length;
  const completedCount = completedLogs.length;

  const weeklyMileageTrend = Array.from(new Set([...weeklyActual.keys(), ...weeklyPlanned.keys()]))
    .sort((a, b) => a.localeCompare(b))
    .map((week_start) => ({
      week_start,
      actual_km: weeklyActual.get(week_start) ?? 0,
      planned_km: weeklyPlanned.get(week_start) ?? 0,
    }));

  const monthlyMileageTrend = Array.from(new Set([...monthlyActual.keys(), ...monthlyPlanned.keys()]))
    .sort((a, b) => a.localeCompare(b))
    .map((month) => ({
      month,
      actual_km: monthlyActual.get(month) ?? 0,
      planned_km: monthlyPlanned.get(month) ?? 0,
    }));

  const paceTrend = completedLogs
    .filter((log) => toNumber(log.actual_pace_seconds_per_km, 0) > 0)
    .map((log) => ({ date: log.date, pace_seconds_per_km: toNumber(log.actual_pace_seconds_per_km), pace_text: log.actual_pace_text }));

  const weightTrend = logRows
    .filter((log) => log.body_weight_kg !== null)
    .map((log) => ({ date: log.date, weight_kg: toNumber(log.body_weight_kg) }));

  const sleepTrend = logRows
    .filter((log) => log.sleep_hours !== null)
    .map((log) => ({ date: log.date, sleep_hours: toNumber(log.sleep_hours) }));

  const fatigueTrend = logRows
    .filter((log) => log.fatigue_level !== null)
    .map((log) => ({ date: log.date, fatigue_level: toNumber(log.fatigue_level) }));

  const rpeMileage = completedLogs
    .filter((log) => log.rpe !== null)
    .map((log) => ({ date: log.date, rpe: toNumber(log.rpe), distance_km: toNumber(log.actual_distance_km) }));

  const completionQualityTrend = completedLogs
    .map((log) => {
      if (!log.workouts) return null;
      const workout: WorkoutWithLog = {
        id: log.workouts.id,
        date: log.workouts.date,
        week_number: toNumber(log.workouts.week_number),
        workout_type: log.workouts.workout_type,
        title: log.workouts.title,
        planned_distance_km: toNumber(log.workouts.planned_distance_km),
        planned_duration_min: toNumber(log.workouts.planned_duration_min),
        planned_pace_text: log.workouts.planned_pace_text ?? null,
        planned_pace_seconds_per_km: log.workouts.planned_pace_seconds_per_km === null ? null : toNumber(log.workouts.planned_pace_seconds_per_km),
        planned_rpe: log.workouts.planned_rpe === null ? null : toNumber(log.workouts.planned_rpe),
        purpose: log.workouts.purpose ?? null,
        warmup: log.workouts.warmup ?? null,
        main_set: log.workouts.main_set ?? null,
        cooldown: log.workouts.cooldown ?? null,
        strength_training: Boolean(log.workouts.strength_training),
        notes: log.workouts.notes ?? null,
        completed: Boolean(log.workouts.completed),
        skipped: Boolean(log.workouts.skipped),
        log: {
          ...log,
          actual_distance_km: toNumber(log.actual_distance_km),
          actual_duration_seconds: toNumber(log.actual_duration_seconds),
          actual_pace_seconds_per_km: log.actual_pace_seconds_per_km === null ? null : toNumber(log.actual_pace_seconds_per_km),
          rpe: log.rpe === null ? null : toNumber(log.rpe),
          sleep_hours: log.sleep_hours === null ? null : toNumber(log.sleep_hours),
          body_weight_kg: log.body_weight_kg === null ? null : toNumber(log.body_weight_kg),
          fatigue_level: log.fatigue_level === null ? null : toNumber(log.fatigue_level),
          pain_score: log.pain_score === null ? null : toNumber(log.pain_score),
          workouts: null,
        },
      };

      const review = buildWorkoutExecutionReview(workout);
      if (!review) return null;

      if (review.status !== "no_log") completionQualitySummary[review.status] += 1;
      const scoreMap: Record<typeof review.status, number> = {
        no_log: 0,
        on_target: 100,
        completed_hard: 72,
        shortened: 45,
        overreached: 30,
      };

      return {
        date: log.date,
        title: workout.title,
        status: review.status,
        pattern: review.pattern,
        pattern_label: review.pattern_label,
        score: scoreMap[review.status],
        headline: review.headline,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const testTrend = testRows.map((test) => ({
    date: test.test_date,
    test_type: test.test_type,
    result_time_seconds: toNumber(test.result_time_seconds),
    avg_pace_seconds_per_km: toNumber(test.avg_pace_seconds_per_km),
    predicted_half_marathon_seconds: test.predicted_half_marathon_seconds ? toNumber(test.predicted_half_marathon_seconds) : null,
  }));

  const averageSleep = sleepTrend.length > 0 ? sleepTrend.reduce((sum, item) => sum + item.sleep_hours, 0) / sleepTrend.length : null;
  const latestFatigue = fatigueTrend.at(-1)?.fatigue_level ?? null;
  const completionRate = percent(completedCount, plannedPast);

  return ok({
    summary: {
      planned_workouts: plannedPast,
      completed_workouts: completedCount,
      completion_rate: completionRate,
      total_actual_km: round1(completedLogs.reduce((sum, log) => sum + toNumber(log.actual_distance_km), 0)),
    },
    weekly_mileage_trend: weeklyMileageTrend,
    monthly_mileage_trend: monthlyMileageTrend,
    completion_rate: [{ label: "Completion rate", value: completionRate }],
    pace_trend: paceTrend,
    weight_trend: weightTrend,
    sleep_trend: sleepTrend,
    fatigue_trend: fatigueTrend,
    rpe_mileage: rpeMileage,
    type_distribution: mapToSeries(typeDistribution, "count").map((item) => ({ workout_type: item.date, count: item.count })),
    test_trend: testTrend,
    workout_type_comparison: Array.from(typeMetrics.entries()).map(([workout_type, metric]) => ({
      workout_type,
      count: metric.count,
      avg_distance_km: round1(metric.distance / metric.count),
      avg_rpe: metric.rpeCount > 0 ? round1(metric.rpeTotal / metric.rpeCount) : null,
      avg_pace_seconds_per_km: metric.paceCount > 0 ? Math.round(metric.paceTotal / metric.paceCount) : null,
    })),
    completion_quality_trend: completionQualityTrend,
    completion_quality_summary: completionQualitySummary,
    readiness_load: {
      fatigue_score: latestFatigue ?? 0,
      sleep_score: averageSleep == null ? 0 : round1(averageSleep),
      consistency_score: completionRate,
      recommendation:
        latestFatigue !== null && latestFatigue >= 8
          ? "Fatigue is elevated. Reduce load, protect sleep, and avoid stacking hard sessions."
          : averageSleep !== null && averageSleep < 6
            ? "Recent sleep is low. Keep the next key session conservative until recovery rebounds."
            : completionRate < 60
              ? "Completion consistency is slipping. Simplify the plan before trying to rebuild volume."
              : "Recent readiness and completion are stable enough to keep building as planned.",
    },
  });
});
