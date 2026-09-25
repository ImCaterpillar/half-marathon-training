import type { AIWorkout, DailyAdvice, WeeklyAdjustment } from "@/lib/ai/schemas";
import { round1 } from "@/lib/format";
import type { TrainingDay, TrainingPreferences } from "@/lib/types/training";
import { addDays, parseDateOnly } from "@/lib/time";

const weekdayIndex: Record<TrainingDay, number> = {
  monday: 0,
  tuesday: 1,
  wednesday: 2,
  thursday: 3,
  friday: 4,
  saturday: 5,
  sunday: 6,
};

const dayLabel: Record<TrainingDay, string> = {
  monday: "周一",
  tuesday: "周二",
  wednesday: "周三",
  thursday: "周四",
  friday: "周五",
  saturday: "周六",
  sunday: "周日",
};

function getTrainingDay(date: string): TrainingDay {
  const weekday = parseDateOnly(date).getUTCDay();
  const order: TrainingDay[] = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  return order[weekday] ?? "monday";
}

function dateForTrainingDay(weekStart: string, day: TrainingDay) {
  return addDays(weekStart, weekdayIndex[day]);
}

function isHardWorkout(workout: AIWorkout) {
  const text = `${workout.workout_type} ${workout.title} ${workout.main_set ?? ""}`.toLowerCase();
  return /interval|tempo|threshold|hill|fartlek|race|test|间歇|节奏|阈值|爬坡|冲刺|测试/.test(text) || (workout.planned_rpe ?? 0) >= 6;
}

function isLongRun(workout: AIWorkout) {
  const text = `${workout.workout_type} ${workout.title}`.toLowerCase();
  return /long|long_run|长距离|长跑/.test(text) || workout.planned_distance_km >= 14;
}

function isStrengthOnly(workout: AIWorkout) {
  const text = `${workout.workout_type} ${workout.title}`.toLowerCase();
  return workout.planned_distance_km <= 0.1 && (workout.strength_training || /strength|gym|力量/.test(text));
}

function workoutPriority(workout: AIWorkout) {
  if (isLongRun(workout)) return 100;
  if (isHardWorkout(workout)) return 80;
  if (isStrengthOnly(workout)) return 20;
  return 50;
}

function appendNote(workout: AIWorkout, note: string) {
  return {
    ...workout,
    notes: [workout.notes, note].filter(Boolean).join(" | "),
  };
}

function normalizeWorkout(workout: AIWorkout): AIWorkout {
  return {
    ...workout,
    planned_distance_km: round1(Math.max(0, workout.planned_distance_km)),
    planned_duration_min: Math.max(0, Math.round(workout.planned_duration_min)),
  };
}

export function enforceWeeklyPlanPreferences(
  plan: WeeklyAdjustment,
  preferences: TrainingPreferences,
  weekStart: string
): WeeklyAdjustment {
  let workouts = plan.workouts.map((workout) => ({ ...workout }));
  const notes = [...plan.notes];

  const longRun = workouts.find((workout) => isLongRun(workout));
  if (longRun) {
    const preferredDate = dateForTrainingDay(weekStart, preferences.preferred_long_run_day);
    if (longRun.date !== preferredDate) {
      longRun.date = preferredDate;
      notes.push(`长距离训练已移动到偏好日期 ${dayLabel[preferences.preferred_long_run_day]}。`);
    }
  }

  const allowedHardDays = new Set(preferences.allowed_hard_workout_days);
  for (const workout of workouts) {
    if (!isHardWorkout(workout)) continue;
    const workoutDay = getTrainingDay(workout.date);
    if (allowedHardDays.has(workoutDay)) continue;

    const targetDay = preferences.allowed_hard_workout_days[0] ?? preferences.preferred_long_run_day;
    workout.date = dateForTrainingDay(weekStart, targetDay);
    workout.notes = [workout.notes, `已按训练偏好移动到 ${dayLabel[targetDay]} 进行高质量课。`].filter(Boolean).join(" | ");
    notes.push(`高质量课 ${workout.title} 已调整到允许日期 ${dayLabel[targetDay]}。`);
  }

  if (!preferences.strength_training_enabled) {
    workouts = workouts
      .filter((workout) => !isStrengthOnly(workout))
      .map((workout) => ({ ...workout, strength_training: false }));
    notes.push("已关闭力量训练，计划中的纯力量课已移除。");
  } else if (preferences.strength_context === "bodyweight") {
    workouts = workouts.map((workout) => workout.strength_training ? appendNote(workout, "力量内容请优先改为徒手版本。") : workout);
  }

  let maxTrainingDays = preferences.training_days_per_week;
  let volumeMultiplier = 1;
  if (preferences.temporary_constraint === "travel_week") {
    maxTrainingDays = Math.max(1, maxTrainingDays - 1);
    volumeMultiplier = 0.8;
    notes.push("当前为出差周，计划已自动收紧训练天数与总量。");
  }
  if (preferences.temporary_constraint === "reduced_load_week") {
    maxTrainingDays = Math.max(1, maxTrainingDays - 1);
    volumeMultiplier = 0.7;
    notes.push("当前为减量周，计划已自动下调训练负荷。");
  }

  const dayScores = new Map<string, number>();
  for (const workout of workouts) {
    dayScores.set(workout.date, Math.max(dayScores.get(workout.date) ?? 0, workoutPriority(workout)));
  }
  const allowedDates = new Set(
    Array.from(dayScores.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, maxTrainingDays)
      .map(([date]) => date)
  );
  if (allowedDates.size < dayScores.size) {
    workouts = workouts.filter((workout) => allowedDates.has(workout.date));
    notes.push(`计划已按偏好收敛为每周 ${maxTrainingDays} 个训练日。`);
  }

  let adjusted = workouts.map(normalizeWorkout);
  const currentKm = adjusted.reduce((sum, workout) => sum + workout.planned_distance_km, 0);
  const currentMinutes = adjusted.reduce((sum, workout) => sum + workout.planned_duration_min, 0);
  const cappedKm = preferences.weekly_mileage_tolerance_km ? Math.min(currentKm, preferences.weekly_mileage_tolerance_km) : currentKm;
  const cappedMinutes = preferences.weekly_time_capacity_minutes ? Math.min(currentMinutes, preferences.weekly_time_capacity_minutes) : currentMinutes;
  const kmScale = currentKm > 0 ? cappedKm / currentKm : 1;
  const timeScale = currentMinutes > 0 ? cappedMinutes / currentMinutes : 1;
  const scale = Math.min(kmScale, timeScale, volumeMultiplier);

  if (scale < 0.999) {
    adjusted = adjusted.map((workout) => {
      if (workout.planned_distance_km <= 0 && workout.planned_duration_min <= 0) return workout;
      return appendNote(
        {
          ...workout,
          planned_distance_km: round1(workout.planned_distance_km * scale),
          planned_duration_min: Math.max(10, Math.round(workout.planned_duration_min * scale)),
        },
        "已按每周里程/时长限制自动缩减负荷。"
      );
    });
    notes.push("计划总量已按训练偏好中的时长、跑量或临时限制自动缩减。");
  }

  adjusted.sort((a, b) => a.date.localeCompare(b.date) || workoutPriority(b) - workoutPriority(a));

  const plannedKm = round1(adjusted.reduce((sum, workout) => sum + workout.planned_distance_km, 0));
  const uniqueDates = new Set(adjusted.map((workout) => workout.date)).size;

  return {
    ...plan,
    summary: `${plan.summary} 当前计划已校准为 ${uniqueDates} 个训练日、约 ${plannedKm} km。`,
    weekly_mileage_recommendation: {
      planned_km: plannedKm,
      reason: `${plan.weekly_mileage_recommendation.reason} 已按训练偏好进行排课与负荷校准。`,
    },
    workouts: adjusted,
    notes,
  };
}

export function enforceDailyAdvicePreferences(
  advice: DailyAdvice,
  preferences: TrainingPreferences,
  today: string
): DailyAdvice {
  if (!advice.workout_adjustment.should_modify_today) return advice;

  const todayDay = getTrainingDay(today);
  const hardType = advice.workout_adjustment.new_workout_type?.toLowerCase() ?? "";
  const looksHard = /interval|tempo|threshold|hill|fartlek|race|间歇|节奏|阈值|爬坡|冲刺/.test(hardType) || (advice.workout_adjustment.new_rpe ?? 0) >= 6;

  if (looksHard && !preferences.allowed_hard_workout_days.includes(todayDay)) {
    return {
      ...advice,
      recommendation: "改恢复跑",
      workout_adjustment: {
        ...advice.workout_adjustment,
        date: today,
        new_workout_type: "recovery",
        new_rpe: Math.min(advice.workout_adjustment.new_rpe ?? 3, 4),
        new_notes: [advice.workout_adjustment.new_notes, `今天不是你允许的高质量课日期，已自动收敛为恢复安排。`]
          .filter(Boolean)
          .join(" "),
      },
      recovery_advice: [...advice.recovery_advice, "今天不是偏好的高质量课日期，优先做恢复性训练。"],
    };
  }

  return advice;
}
