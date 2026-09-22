import { describe, expect, it } from "vitest";
import { generatedPhaseTemplates, generatedPlanSourceSummary, generatedWorkoutTemplates } from "../scripts/seed-plan-data";

describe("generated seed plan data", () => {
  it("contains the 7 annual phases from the research plan", () => {
    expect(generatedPhaseTemplates).toHaveLength(7);
    expect(generatedPhaseTemplates[0].phase_name).toBe("复跑适应期");
    expect(generatedPhaseTemplates.at(-1)?.phase_name).toBe("赛前调整期");
  });

  it("contains 12 weeks of daily workouts", () => {
    expect(generatedWorkoutTemplates).toHaveLength(84);
    expect(generatedPlanSourceSummary.workout_count).toBe(84);
  });

  it("keeps weekly seeded mileage inside the research target ranges", () => {
    for (const week of generatedPlanSourceSummary.week_summaries) {
      const [min, max] = week.target_range.match(/\d+/g)?.map(Number) ?? [];
      expect(week.seeded_distance_km).toBeGreaterThanOrEqual(min);
      expect(week.seeded_distance_km).toBeLessThanOrEqual(max);
    }
  });
});
