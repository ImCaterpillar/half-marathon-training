import { z } from "zod";

export const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式必须为 YYYY-MM-DD");
const optionalText = z.string().trim().max(6000).optional().nullable().transform((value) => value === "" ? null : value ?? null);
const optionalShortText = z.string().trim().max(240).optional().nullable().transform((value) => value === "" ? null : value ?? null);

const phaseFieldsSchema = z.object({
  phase_name: z.string().trim().min(1).max(120),
  start_date: dateString,
  end_date: dateString,
  goal: z.string().trim().min(1).max(2000),
  weekly_mileage_min: z.coerce.number().min(0),
  weekly_mileage_max: z.coerce.number().min(0),
  training_days: z.coerce.number().int().min(1).max(7),
  key_workouts: optionalText,
  test_standard: optionalText,
  ai_notes: optionalText,
});

export const phaseSchema = phaseFieldsSchema
  .refine((value) => value.end_date >= value.start_date, { message: "结束日期不能早于开始日期", path: ["end_date"] })
  .refine((value) => value.weekly_mileage_max >= value.weekly_mileage_min, { message: "周跑量上限不能小于下限", path: ["weekly_mileage_max"] });

export const phaseUpdateSchema = phaseFieldsSchema
  .partial()
  .refine((value) => {
    if (value.start_date && value.end_date) return value.end_date >= value.start_date;
    return true;
  }, { message: "结束日期不能早于开始日期", path: ["end_date"] })
  .refine((value) => {
    if (value.weekly_mileage_min !== undefined && value.weekly_mileage_max !== undefined) {
      return value.weekly_mileage_max >= value.weekly_mileage_min;
    }
    return true;
  }, { message: "周跑量上限不能小于下限", path: ["weekly_mileage_max"] });

export const testResultSchema = z.object({
  test_date: dateString,
  test_type: z.enum(["3km", "5km", "10km", "15km", "半马"]),
  distance_km: z.coerce.number().min(0.1),
  result_time_text: z.string().trim().min(1).max(40),
  result_time_seconds: z.coerce.number().int().min(1),
  avg_pace_text: z.string().trim().min(1).max(40),
  avg_pace_seconds_per_km: z.coerce.number().int().min(1),
  weather: optionalShortText,
  route: optionalShortText,
  feeling: optionalText,
  predicted_half_marathon_seconds: z.coerce.number().int().min(1).optional().nullable(),
  predicted_half_marathon_text: optionalShortText,
  ai_analysis: optionalText,
  notes: optionalText,
});

export const bodyMetricSchema = z.object({
  date: dateString,
  weight_kg: z.coerce.number().min(1),
  sleep_hours: z.coerce.number().min(0).max(24).optional().nullable(),
  fatigue_level: z.coerce.number().int().min(1).max(5).optional().nullable(),
  pain_area: optionalShortText,
  pain_score: z.coerce.number().int().min(0).max(10).optional().nullable(),
  resting_hr: z.coerce.number().int().min(1).optional().nullable(),
  recovery_score: z.coerce.number().int().min(0).max(100).optional().nullable(),
  ai_recovery_advice: optionalText,
  notes: optionalText,
});

export const rangeQuerySchema = z.object({
  start: dateString.optional(),
  end: dateString.optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/, "月份格式必须为 YYYY-MM").optional(),
  limit: z.coerce.number().int().min(1).max(1000).optional(),
});

export const restoreVersionSchema = z.object({
  confirm: z.literal(true),
  change_reason: z.string().trim().max(500).optional(),
});

export const csvPreviewSchema = z.object({
  csv_text: z.string().min(1, "请粘贴 CSV 内容"),
});

export const csvApplySchema = z.object({
  confirm: z.literal(true),
  rows: z.array(z.record(z.string(), z.unknown())).min(1),
  change_reason: z.string().trim().max(500).optional(),
});

export const jsonPreviewSchema = z.object({
  payload: z.unknown(),
});

export const jsonApplySchema = z.object({
  confirm: z.literal(true),
  payload: z.unknown(),
  change_reason: z.string().trim().max(500).optional(),
});
