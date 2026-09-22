import { computePaceSeconds, computePaceText } from "@/lib/format";

export type NormalizedWorkoutLogInput = {
  completed: boolean;
  actual_distance_km: number;
  actual_duration_seconds: number;
  rpe?: number | null;
  sleep_hours?: number | null;
  body_weight_kg?: number | null;
  fatigue_level?: number | null;
  pain_area?: string | null;
  pain_score?: number | null;
  weather?: string | null;
  notes?: string | null;
};

export function buildWorkoutLogPayload(workoutId: string, date: string, input: NormalizedWorkoutLogInput) {
  const actualPaceSeconds = computePaceSeconds(input.actual_duration_seconds, input.actual_distance_km);
  return {
    workout_id: workoutId,
    date,
    completed: input.completed,
    actual_distance_km: input.actual_distance_km,
    actual_duration_seconds: input.actual_duration_seconds,
    actual_pace_text: computePaceText(input.actual_duration_seconds, input.actual_distance_km),
    actual_pace_seconds_per_km: actualPaceSeconds,
    rpe: input.rpe ?? null,
    sleep_hours: input.sleep_hours ?? null,
    body_weight_kg: input.body_weight_kg ?? null,
    fatigue_level: input.fatigue_level ?? null,
    pain_area: input.pain_area ?? null,
    pain_score: input.pain_score ?? null,
    weather: input.weather ?? null,
    notes: input.notes ?? null,
  };
}
