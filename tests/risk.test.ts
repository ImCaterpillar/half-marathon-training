import { describe, expect, it } from "vitest";
import { evaluateTrainingRisk } from "@/lib/risk";
import type { WorkoutLog } from "@/lib/types/training";

function log(partial: Partial<WorkoutLog>): WorkoutLog {
  return {
    id: partial.id ?? crypto.randomUUID(),
    workout_id: partial.workout_id ?? crypto.randomUUID(),
    date: partial.date ?? "2026-05-20",
    completed: partial.completed ?? true,
    actual_distance_km: partial.actual_distance_km ?? 5,
    actual_duration_seconds: partial.actual_duration_seconds ?? 1800,
    actual_pace_text: partial.actual_pace_text ?? null,
    actual_pace_seconds_per_km: partial.actual_pace_seconds_per_km ?? null,
    rpe: partial.rpe ?? 3,
    sleep_hours: partial.sleep_hours ?? 7,
    body_weight_kg: partial.body_weight_kg ?? null,
    fatigue_level: partial.fatigue_level ?? 2,
    pain_area: partial.pain_area ?? null,
    pain_score: partial.pain_score ?? 0,
    weather: partial.weather ?? null,
    notes: partial.notes ?? null,
    workouts: partial.workouts ?? { id: "w", title: "轻松跑", planned_rpe: 3, planned_distance_km: 5, workout_type: "轻松跑" },
  };
}

describe("evaluateTrainingRisk", () => {
  it("returns green when sleep, fatigue, pain and mileage are safe", () => {
    const result = evaluateTrainingRisk({
      recent7Logs: [log({ date: "2026-05-21" }), log({ date: "2026-05-20" })],
      recent14Logs: [log({ date: "2026-05-21" }), log({ date: "2026-05-20" })],
      plannedWeeklyMileage: 10,
      actualWeeklyMileage: 10,
      previousWeeklyMileage: 9,
    });
    expect(result.risk_level).toBe("green");
  });

  it("returns yellow for two days of poor sleep", () => {
    const result = evaluateTrainingRisk({
      recent7Logs: [log({ date: "2026-05-21", sleep_hours: 5.8 }), log({ date: "2026-05-20", sleep_hours: 5.5 })],
      recent14Logs: [log({ date: "2026-05-21", sleep_hours: 5.8 }), log({ date: "2026-05-20", sleep_hours: 5.5 })],
      plannedWeeklyMileage: 10,
      actualWeeklyMileage: 10,
      previousWeeklyMileage: 9,
    });
    expect(result.risk_level).toBe("yellow");
  });

  it("returns red for pain score 6 or above", () => {
    const result = evaluateTrainingRisk({
      recent7Logs: [log({ pain_score: 6, pain_area: "膝盖" })],
      recent14Logs: [log({ pain_score: 6, pain_area: "膝盖" })],
      plannedWeeklyMileage: 10,
      actualWeeklyMileage: 10,
      previousWeeklyMileage: 9,
    });
    expect(result.risk_level).toBe("red");
    expect(result.should_modify_today).toBe(true);
  });
});
