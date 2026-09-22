import { describe, expect, it } from "vitest";
import type { WeeklyAdjustment } from "@/lib/ai/schemas";
import { enforceDailyAdvicePreferences, enforceWeeklyPlanPreferences } from "@/lib/services/plan-constraints";
import { defaultTrainingPreferences } from "@/lib/preferences";

describe("plan constraints", () => {
  it("moves long run and hard workouts onto preferred days and caps training days", () => {
    const plan: WeeklyAdjustment = {
      summary: "下周继续推进。",
      risk_level: "green",
      weekly_mileage_recommendation: { planned_km: 44, reason: "保持连续训练" },
      notes: [],
      workouts: [
        { date: "2026-05-25", week_number: 22, workout_type: "easy", title: "轻松跑", planned_distance_km: 6, planned_duration_min: 40, strength_training: false },
        { date: "2026-05-26", week_number: 22, workout_type: "tempo", title: "节奏跑", planned_distance_km: 8, planned_duration_min: 50, planned_rpe: 7, strength_training: false },
        { date: "2026-05-27", week_number: 22, workout_type: "easy", title: "恢复跑", planned_distance_km: 5, planned_duration_min: 35, strength_training: false },
        { date: "2026-05-28", week_number: 22, workout_type: "easy", title: "轻松跑 2", planned_distance_km: 7, planned_duration_min: 45, strength_training: false },
        { date: "2026-05-30", week_number: 22, workout_type: "long_run", title: "长距离 18km", planned_distance_km: 18, planned_duration_min: 110, planned_rpe: 4, strength_training: false },
      ],
    };

    const adjusted = enforceWeeklyPlanPreferences(
      plan,
      {
        ...defaultTrainingPreferences,
        training_days_per_week: 4,
        preferred_long_run_day: "sunday",
        allowed_hard_workout_days: ["tuesday"],
      },
      "2026-05-25"
    );

    expect(new Set(adjusted.workouts.map((workout) => workout.date)).size).toBeLessThanOrEqual(4);
    expect(adjusted.workouts.find((workout) => workout.title.includes("长距离"))?.date).toBe("2026-05-31");
    expect(adjusted.workouts.find((workout) => workout.title.includes("节奏"))?.date).toBe("2026-05-26");
  });

  it("shrinks weekly volume and removes strength-only workouts when preferences require it", () => {
    const plan: WeeklyAdjustment = {
      summary: "以恢复周方式安排。",
      risk_level: "yellow",
      weekly_mileage_recommendation: { planned_km: 32, reason: "控制负荷" },
      notes: [],
      workouts: [
        { date: "2026-05-25", week_number: 22, workout_type: "strength", title: "力量训练", planned_distance_km: 0, planned_duration_min: 35, strength_training: true },
        { date: "2026-05-26", week_number: 22, workout_type: "easy", title: "轻松跑", planned_distance_km: 10, planned_duration_min: 60, strength_training: false },
        { date: "2026-05-27", week_number: 22, workout_type: "easy", title: "轻松跑 2", planned_distance_km: 10, planned_duration_min: 60, strength_training: false },
        { date: "2026-05-31", week_number: 22, workout_type: "long_run", title: "长距离 14km", planned_distance_km: 14, planned_duration_min: 85, strength_training: false },
      ],
    };

    const adjusted = enforceWeeklyPlanPreferences(
      plan,
      {
        ...defaultTrainingPreferences,
        strength_training_enabled: false,
        weekly_time_capacity_minutes: 120,
        weekly_mileage_tolerance_km: 20,
        temporary_constraint: "reduced_load_week",
      },
      "2026-05-25"
    );

    expect(adjusted.workouts.some((workout) => workout.title.includes("力量"))).toBe(false);
    expect(adjusted.weekly_mileage_recommendation.planned_km).toBeLessThanOrEqual(20);
    expect(adjusted.notes.join(" ")).toContain("减量周");
  });

  it("downgrades daily hard workout advice on disallowed days", () => {
    const adjusted = enforceDailyAdvicePreferences(
      {
        summary: "今天建议调整训练。",
        risk_level: "yellow",
        risk_reasons: ["疲劳偏高"],
        recommendation: "降低强度",
        workout_adjustment: {
          should_modify_today: true,
          date: "2026-05-28",
          new_workout_type: "tempo",
          new_distance_km: 8,
          new_rpe: 7,
          new_notes: "保留刺激",
        },
        recovery_advice: [],
        nutrition_advice: [],
      },
      {
        ...defaultTrainingPreferences,
        allowed_hard_workout_days: ["tuesday"],
      },
      "2026-05-28"
    );

    expect(adjusted.workout_adjustment.new_workout_type).toBe("recovery");
    expect(adjusted.recommendation).toBe("改恢复跑");
  });
});
