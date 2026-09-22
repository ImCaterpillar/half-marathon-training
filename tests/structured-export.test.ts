import { describe, expect, it } from "vitest";
import { buildStructuredWorkoutExport, parseStructuredWorkoutExport, structuredWorkoutExportVersion } from "@/lib/services/structured-export";

describe("structured workout export", () => {
  it("round-trips exported workouts into import-safe rows", () => {
    const payload = buildStructuredWorkoutExport(
      [
        {
          date: "2026-06-01",
          week_number: 23,
          workout_type: "tempo",
          title: "Tempo 8 km",
          planned_distance_km: 8,
          planned_duration_min: 46,
          planned_pace_text: "5'45\"/km",
          planned_pace_seconds_per_km: 345,
          planned_rpe: 6,
          purpose: "Threshold support",
          warmup: "10 min easy",
          main_set: "3 x 8 min tempo",
          cooldown: "10 min easy",
          strength_training: false,
          notes: "Keep it controlled",
        },
      ],
      { start: "2026-06-01", end: "2026-06-14" }
    );

    const parsed = parseStructuredWorkoutExport(payload);
    expect(parsed.valid).toBe(true);
    expect(parsed.errors).toEqual([]);
    expect(parsed.meta?.version).toBe(structuredWorkoutExportVersion);
    expect(parsed.rows).toHaveLength(1);
    expect(parsed.rows[0].title).toBe("Tempo 8 km");
    expect(parsed.rows[0].week_number).toBe(23);
  });

  it("rejects unsupported structured export versions", () => {
    const parsed = parseStructuredWorkoutExport({
      version: "structured-workouts-v0",
      workouts: [],
    });

    expect(parsed.valid).toBe(false);
    expect(parsed.errors[0]).toContain("Unsupported structured export version");
  });
});
