import { z } from "zod";

export const riskLevelSchema = z.enum(["green", "yellow", "orange", "red"]);

export const workoutAdjustmentSchema = z.object({
  should_modify_today: z.boolean(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  new_workout_type: z.string().min(1).max(80).nullable().optional(),
  new_distance_km: z.coerce.number().min(0).nullable().optional(),
  new_rpe: z.coerce.number().int().min(1).max(10).nullable().optional(),
  new_notes: z.string().max(2000).nullable().optional(),
});

export const dailyAdviceSchema = z.object({
  summary: z.string().min(1).max(1000),
  risk_level: riskLevelSchema,
  risk_reasons: z.array(z.string().min(1).max(300)).default([]),
  recommendation: z.enum(["照常训练", "降低强度", "改恢复跑", "休息", "改交叉训练"]),
  workout_adjustment: workoutAdjustmentSchema,
  recovery_advice: z.array(z.string().min(1).max(300)).default([]),
  nutrition_advice: z.array(z.string().min(1).max(300)).default([]),
});

export const aiWorkoutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  week_number: z.coerce.number().int().min(1).optional(),
  workout_type: z.string().min(1).max(80),
  title: z.string().min(1).max(160),
  planned_distance_km: z.coerce.number().min(0),
  planned_duration_min: z.coerce.number().int().min(0),
  planned_pace_text: z.string().max(80).nullable().optional(),
  planned_pace_seconds_per_km: z.coerce.number().int().min(0).nullable().optional(),
  planned_rpe: z.coerce.number().int().min(1).max(10).nullable().optional(),
  purpose: z.string().max(1000).nullable().optional(),
  warmup: z.string().max(1000).nullable().optional(),
  main_set: z.string().max(2000).nullable().optional(),
  cooldown: z.string().max(1000).nullable().optional(),
  strength_training: z.boolean().default(false),
  notes: z.string().max(2000).nullable().optional(),
});

export const weeklyAdjustmentSchema = z.object({
  summary: z.string().min(1).max(1000),
  risk_level: riskLevelSchema,
  weekly_mileage_recommendation: z.object({
    planned_km: z.coerce.number().min(0),
    reason: z.string().min(1).max(1000),
  }),
  workouts: z.array(aiWorkoutSchema).min(1).max(14),
  notes: z.array(z.string().min(1).max(400)).default([]),
});

export const phaseReviewSchema = z.object({
  summary: z.string().min(1).max(1000),
  risk_level: riskLevelSchema,
  can_enter_next_phase: z.boolean(),
  reasons: z.array(z.string().min(1).max(400)).default([]),
  suggested_gate: z.string().max(1000).optional(),
});


export const riskAnalysisSchema = z.object({
  summary: z.string().min(1).max(1000),
  risk_level: riskLevelSchema,
  risk_reasons: z.array(z.string().min(1).max(400)).default([]),
  recommended_action: z.string().min(1).max(1000),
  should_modify_today: z.boolean().default(false),
});

export const generatedPlanSchema = weeklyAdjustmentSchema;

export type DailyAdvice = z.infer<typeof dailyAdviceSchema>;
export type WeeklyAdjustment = z.infer<typeof weeklyAdjustmentSchema>;
export type AIWorkout = z.infer<typeof aiWorkoutSchema>;
export type PhaseReview = z.infer<typeof phaseReviewSchema>;
export type RiskAnalysis = z.infer<typeof riskAnalysisSchema>;
