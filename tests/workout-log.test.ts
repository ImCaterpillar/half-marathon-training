import { describe, expect, it } from "vitest";
import { buildWorkoutLogPayload } from "@/lib/services/workout-log";

describe("buildWorkoutLogPayload", () => {
  it("computes pace and preserves workout_id for upsert uniqueness", () => {
    const payload = buildWorkoutLogPayload("workout-1", "2026-05-22", {
      completed: true,
      actual_distance_km: 5,
      actual_duration_seconds: 1500,
      rpe: 4,
    });

    expect(payload.workout_id).toBe("workout-1");
    expect(payload.actual_pace_seconds_per_km).toBe(300);
    expect(payload.actual_pace_text).toBe("5'00\"/km");
  });
});
