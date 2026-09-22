import { describe, expect, it } from "vitest";
import { settingsUpdateSchema, syncPendingLogsSchema } from "@/lib/validation/settings";

describe("settings validation", () => {
  it("accepts profile and app setting updates", () => {
    const parsed = settingsUpdateSchema.parse({
      profile: { name: "姚俊豪", age: 23, target_race_date: "" },
      app_settings: { dark_mode: true, pwa_enabled: true },
    });
    expect(parsed.profile?.target_race_date).toBeNull();
    expect(parsed.app_settings?.dark_mode).toBe(true);
  });

  it("accepts training preferences and preserves nullable limits", () => {
    const parsed = settingsUpdateSchema.parse({
      app_settings: {
        training_preferences: {
          training_days_per_week: 4,
          preferred_long_run_day: "sunday",
          allowed_hard_workout_days: ["tuesday", "friday"],
          strength_training_enabled: true,
          strength_context: "bodyweight",
          weekly_time_capacity_minutes: null,
          weekly_mileage_tolerance_km: 42,
          temporary_constraint: "travel_week",
        },
      },
    });

    expect(parsed.app_settings?.training_preferences?.preferred_long_run_day).toBe("sunday");
    expect(parsed.app_settings?.training_preferences?.weekly_time_capacity_minutes).toBeNull();
    expect(parsed.app_settings?.training_preferences?.allowed_hard_workout_days).toEqual(["tuesday", "friday"]);
  });

  it("validates offline pending log batches", () => {
    const parsed = syncPendingLogsSchema.parse({
      logs: [{
        localId: "local-1",
        workoutId: "00000000-0000-4000-8000-000000000001",
        workoutDate: "2026-05-22",
        workoutTitle: "轻松跑",
        payload: { completed: true, actual_distance_km: 5, actual_duration_seconds: 1800 },
        createdAt: new Date().toISOString(),
      }],
    });
    expect(parsed.logs).toHaveLength(1);
  });
});
