import { describe, expect, it } from "vitest";
import { dailyAdviceSchema, weeklyAdjustmentSchema } from "@/lib/ai/schemas";

describe("AI output schemas", () => {
  it("validates daily advice JSON", () => {
    const parsed = dailyAdviceSchema.parse({
      summary: "今天降低强度",
      risk_level: "yellow",
      risk_reasons: ["睡眠不足"],
      recommendation: "改恢复跑",
      workout_adjustment: {
        should_modify_today: true,
        new_workout_type: "恢复跑",
        new_distance_km: 4,
        new_rpe: 3,
        new_notes: "降低强度",
      },
      recovery_advice: ["早点睡"],
      nutrition_advice: ["补充碳水"],
    });
    expect(parsed.risk_level).toBe("yellow");
  });

  it("validates weekly adjustment workouts", () => {
    const parsed = weeklyAdjustmentSchema.parse({
      summary: "下周保守恢复",
      risk_level: "green",
      weekly_mileage_recommendation: { planned_km: 18, reason: "刚复跑" },
      workouts: [
        {
          date: "2026-05-25",
          workout_type: "轻松跑",
          title: "轻松跑 5km",
          planned_distance_km: 5,
          planned_duration_min: 35,
          planned_pace_text: "7'00/km",
          planned_pace_seconds_per_km: 420,
          planned_rpe: 3,
          purpose: "有氧恢复",
          warmup: "动态热身",
          main_set: "轻松跑 5km",
          cooldown: "拉伸",
          strength_training: false,
          notes: "保持轻松",
        },
      ],
      notes: ["不追配速"],
    });
    expect(parsed.workouts).toHaveLength(1);
  });
});
