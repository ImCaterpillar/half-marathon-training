import { z } from "zod";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD");
const optionalText = z.string().trim().max(4000).optional().nullable().transform((value) => value === "" ? null : value ?? null);
const optionalShortText = z.string().trim().max(200).optional().nullable().transform((value) => value === "" ? null : value ?? null);

export const workoutCreateSchema = z.object({
  date: dateString,
  week_number: z.coerce.number().int().min(1).default(1),
  workout_type: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(160),
  planned_distance_km: z.coerce.number().min(0).default(0),
  planned_duration_min: z.coerce.number().int().min(0).default(0),
  planned_pace_text: optionalShortText,
  planned_pace_seconds_per_km: z.coerce.number().int().min(0).optional().nullable(),
  planned_rpe: z.coerce.number().int().min(1).max(10).optional().nullable(),
  purpose: optionalText,
  warmup: optionalText,
  main_set: optionalText,
  cooldown: optionalText,
  strength_training: z.coerce.boolean().default(false),
  notes: optionalText,
  completed: z.coerce.boolean().optional(),
  skipped: z.coerce.boolean().optional(),
});

export const workoutUpdateSchema = workoutCreateSchema.partial().extend({
  completed: z.coerce.boolean().optional(),
  skipped: z.coerce.boolean().optional(),
});

export const workoutLogSchema = z.object({
  completed: z.coerce.boolean().default(true),
  actual_distance_km: z.coerce.number().min(0),
  actual_duration_seconds: z.coerce.number().int().min(0),
  rpe: z.coerce.number().int().min(1).max(10).optional().nullable(),
  sleep_hours: z.coerce.number().min(0).max(24).optional().nullable(),
  body_weight_kg: z.coerce.number().min(1).optional().nullable(),
  fatigue_level: z.coerce.number().int().min(1).max(5).optional().nullable(),
  pain_area: optionalShortText,
  pain_score: z.coerce.number().int().min(0).max(10).optional().nullable(),
  weather: optionalShortText,
  notes: optionalText,
});

export const workoutQuerySchema = z.object({
  start: dateString.optional(),
  end: dateString.optional(),
  date: dateString.optional(),
  limit: z.coerce.number().int().min(1).max(370).optional(),
});
