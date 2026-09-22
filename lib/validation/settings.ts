import { z } from "zod";

const dateOrNull = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal(""), z.null(), z.undefined()]).transform((value) => value ? value : null);
const optionalText = z.union([z.string().trim().max(300), z.literal(""), z.null(), z.undefined()]).transform((value) => value ? value : null);
const trainingDay = z.enum(["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]);

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  age: z.coerce.number().int().min(0).max(120).optional(),
  height_cm: z.coerce.number().min(1).max(260).optional(),
  current_weight_kg: z.coerce.number().min(1).max(300).optional(),
  target_weight_min_kg: z.coerce.number().min(1).max(300).optional(),
  target_weight_max_kg: z.coerce.number().min(1).max(300).optional(),
  target_race_name: optionalText.optional(),
  target_race_date: dateOrNull.optional(),
  max_training_days: z.coerce.number().int().min(1).max(7).optional(),
});

export const trainingPreferencesSchema = z.object({
  training_days_per_week: z.coerce.number().int().min(1).max(7),
  preferred_long_run_day: trainingDay,
  allowed_hard_workout_days: z.array(trainingDay).min(1).max(4),
  strength_training_enabled: z.coerce.boolean(),
  strength_context: z.enum(["bodyweight", "equipment"]),
  weekly_time_capacity_minutes: z.coerce.number().int().min(30).max(2000).optional().nullable(),
  weekly_mileage_tolerance_km: z.coerce.number().min(1).max(500).optional().nullable(),
  temporary_constraint: z.enum(["none", "travel_week", "reduced_load_week"]),
});

export const appSettingsUpdateSchema = z.object({
  access_code_enabled: z.coerce.boolean().optional(),
  dark_mode: z.coerce.boolean().optional(),
  pwa_enabled: z.coerce.boolean().optional(),
  notification_enabled: z.coerce.boolean().optional(),
  ai_model: optionalText.optional(),
  training_preferences: trainingPreferencesSchema.optional(),
});

export const settingsUpdateSchema = z.object({
  profile: profileUpdateSchema.optional(),
  app_settings: appSettingsUpdateSchema.optional(),
});

export const pendingLogSchema = z.object({
  localId: z.string().min(1),
  workoutId: z.string().uuid(),
  workoutDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  workoutTitle: z.string().min(1).max(200),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.string().min(1),
});

export const syncPendingLogsSchema = z.object({
  logs: z.array(pendingLogSchema).min(1).max(50),
});

export const resolveOfflineConflictSchema = pendingLogSchema.extend({
  mode: z.enum(["keep_cloud", "overwrite_cloud", "merge_notes"]),
  cloudLog: z.unknown().optional(),
  pendingPayload: z.record(z.string(), z.unknown()).optional(),
});
