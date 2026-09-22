import { describe, expect, it } from "vitest";
import { parseWorkoutCsv } from "@/lib/services/csv";

describe("parseWorkoutCsv", () => {
  it("parses valid workout CSV rows", () => {
    const csv =
      "date,week_number,workout_type,title,planned_distance_km,planned_duration_min,planned_pace_text,planned_rpe,purpose,warmup,main_set,cooldown,strength_training,notes\n" +
      "2026-06-01,1,easy,Easy 5 km,5,40,8'00/km,3,Recovery jog,5 min walk,Steady easy run,Light stretch,false,Keep it relaxed";

    const result = parseWorkoutCsv(csv);
    expect(result.errors).toEqual([]);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].date).toBe("2026-06-01");
  });

  it("reports missing headers", () => {
    const result = parseWorkoutCsv("date,title\n2026-06-01,Tempo run");
    expect(result.errors.length).toBeGreaterThan(0);
  });
});
