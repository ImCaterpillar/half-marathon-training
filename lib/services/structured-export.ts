import type { WorkoutCsvRow } from "@/lib/services/csv";
import { workoutCreateSchema } from "@/lib/validation/workouts";

export const structuredWorkoutExportVersion = "structured-workouts-v1";

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function normalizeStructuredWorkoutRow(input: unknown) {
  const row = asObject(input);
  if (!row) return null;
  return {
    date: row.date,
    week_number: row.week_number,
    workout_type: row.workout_type,
    title: row.title,
    planned_distance_km: row.planned_distance_km,
    planned_duration_min: row.planned_duration_min,
    planned_pace_text: row.planned_pace_text,
    planned_pace_seconds_per_km: row.planned_pace_seconds_per_km,
    planned_rpe: row.planned_rpe,
    purpose: row.purpose,
    warmup: row.warmup,
    main_set: row.main_set,
    cooldown: row.cooldown,
    strength_training: row.strength_training,
    notes: row.notes,
  };
}

export function buildStructuredWorkoutExport(
  workouts: Array<Record<string, unknown>>,
  range: { start: string; end: string }
) {
  return {
    version: structuredWorkoutExportVersion,
    exported_at: new Date().toISOString(),
    range,
    workout_count: workouts.length,
    workouts: workouts.map((workout) => ({
      date: workout.date,
      week_number: workout.week_number,
      title: workout.title,
      workout_type: workout.workout_type,
      planned_distance_km: workout.planned_distance_km,
      planned_duration_min: workout.planned_duration_min,
      planned_pace_text: workout.planned_pace_text,
      planned_pace_seconds_per_km: workout.planned_pace_seconds_per_km,
      planned_rpe: workout.planned_rpe,
      purpose: workout.purpose,
      warmup: workout.warmup,
      main_set: workout.main_set,
      cooldown: workout.cooldown,
      notes: workout.notes,
      strength_training: workout.strength_training,
    })),
  };
}

export function parseStructuredWorkoutExport(payload: unknown) {
  const root = asObject(payload);
  const errors: string[] = [];

  if (!root) {
    return { valid: false, errors: ["Structured workout export must be a JSON object."], rows: [] as WorkoutCsvRow[], meta: null };
  }

  if (root.version !== structuredWorkoutExportVersion) {
    errors.push(`Unsupported structured export version. Expected ${structuredWorkoutExportVersion}.`);
  }

  const workouts = Array.isArray(root.workouts) ? root.workouts : null;
  if (!workouts) {
    errors.push("Structured export is missing the workouts array.");
    return { valid: false, errors, rows: [] as WorkoutCsvRow[], meta: null };
  }

  const rows: WorkoutCsvRow[] = [];
  workouts.forEach((item, index) => {
    const normalized = normalizeStructuredWorkoutRow(item);
    if (!normalized) {
      errors.push(`Workout ${index + 1} is not a valid object.`);
      return;
    }

    const parsed = workoutCreateSchema.omit({ completed: true, skipped: true }).safeParse(normalized);
    if (!parsed.success) {
      errors.push(
        `Workout ${index + 1} is invalid: ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ")}`
      );
      return;
    }

    rows.push(parsed.data);
  });

  return {
    valid: errors.length === 0,
    errors,
    rows,
    meta: {
      version: root.version,
      exported_at: typeof root.exported_at === "string" ? root.exported_at : null,
      range: asObject(root.range),
      workout_count: typeof root.workout_count === "number" ? root.workout_count : rows.length,
    },
  };
}
