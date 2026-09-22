import type { Json } from "@/lib/db/database";
import type { TrainingDay, TrainingPreferences } from "@/lib/types/training";

export const trainingDayOptions: TrainingDay[] = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];

const trainingDayLabel: Record<TrainingDay, string> = {
  monday: "周一",
  tuesday: "周二",
  wednesday: "周三",
  thursday: "周四",
  friday: "周五",
  saturday: "周六",
  sunday: "周日",
};

export const defaultTrainingPreferences: TrainingPreferences = {
  training_days_per_week: 5,
  preferred_long_run_day: "sunday",
  allowed_hard_workout_days: ["tuesday", "thursday"],
  strength_training_enabled: true,
  strength_context: "bodyweight",
  weekly_time_capacity_minutes: null,
  weekly_mileage_tolerance_km: null,
  temporary_constraint: "none",
};

function isTrainingDay(value: unknown): value is TrainingDay {
  return typeof value === "string" && trainingDayOptions.includes(value as TrainingDay);
}

export function normalizeTrainingPreferences(input: Json | null | undefined): TrainingPreferences {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return defaultTrainingPreferences;
  }

  const value = input as Record<string, Json | undefined>;
  const hardDays = Array.isArray(value.allowed_hard_workout_days)
    ? value.allowed_hard_workout_days.filter(isTrainingDay)
    : defaultTrainingPreferences.allowed_hard_workout_days;

  return {
    training_days_per_week:
      typeof value.training_days_per_week === "number" && value.training_days_per_week >= 1 && value.training_days_per_week <= 7
        ? Math.round(value.training_days_per_week)
        : defaultTrainingPreferences.training_days_per_week,
    preferred_long_run_day: isTrainingDay(value.preferred_long_run_day)
      ? value.preferred_long_run_day
      : defaultTrainingPreferences.preferred_long_run_day,
    allowed_hard_workout_days: hardDays.length > 0 ? hardDays : defaultTrainingPreferences.allowed_hard_workout_days,
    strength_training_enabled:
      typeof value.strength_training_enabled === "boolean"
        ? value.strength_training_enabled
        : defaultTrainingPreferences.strength_training_enabled,
    strength_context:
      value.strength_context === "equipment" || value.strength_context === "bodyweight"
        ? value.strength_context
        : defaultTrainingPreferences.strength_context,
    weekly_time_capacity_minutes:
      typeof value.weekly_time_capacity_minutes === "number" && Number.isFinite(value.weekly_time_capacity_minutes)
        ? value.weekly_time_capacity_minutes
        : null,
    weekly_mileage_tolerance_km:
      typeof value.weekly_mileage_tolerance_km === "number" && Number.isFinite(value.weekly_mileage_tolerance_km)
        ? value.weekly_mileage_tolerance_km
        : null,
    temporary_constraint:
      value.temporary_constraint === "travel_week" || value.temporary_constraint === "reduced_load_week" || value.temporary_constraint === "none"
        ? value.temporary_constraint
        : defaultTrainingPreferences.temporary_constraint,
  };
}

export function summarizeTrainingPreferences(preferences: TrainingPreferences) {
  const hardDays = preferences.allowed_hard_workout_days.map((day) => trainingDayLabel[day]).join("、");
  const volumeText = preferences.weekly_mileage_tolerance_km ? `周跑量容忍 ${preferences.weekly_mileage_tolerance_km} km` : "周跑量弹性未限定";
  const timeText = preferences.weekly_time_capacity_minutes ? `每周可投入约 ${preferences.weekly_time_capacity_minutes} 分钟` : "训练时长按常规安排";
  const constraintText =
    preferences.temporary_constraint === "travel_week"
      ? "本周按出差周保守安排"
      : preferences.temporary_constraint === "reduced_load_week"
        ? "本周按减量周保守安排"
        : "本周无临时限制";

  return `每周 ${preferences.training_days_per_week} 天训练，长跑安排在${trainingDayLabel[preferences.preferred_long_run_day]}，高质量课优先放在${hardDays}，${preferences.strength_training_enabled ? "保留力量训练" : "暂不安排力量训练"}（${preferences.strength_context === "equipment" ? "可用器械" : "徒手优先"}）；${timeText}，${volumeText}；${constraintText}。`;
}
