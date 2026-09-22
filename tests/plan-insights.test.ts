import { describe, expect, it } from "vitest";
import { buildVersionDiffSnapshot, buildVersionWorkoutChanges, buildWorkoutExecutionReview, buildWorkoutVersionChange, enrichPlanVersionSummary } from "@/lib/services/plan-insights";
import type { PlanVersionSummary, WorkoutWithLog } from "@/lib/types/training";

describe("plan insights", () => {
  it("summarizes workout and phase changes for version history", () => {
    const summary: PlanVersionSummary = {
      id: "v1",
      version_name: "AI weekly adjustment",
      change_reason: "Adjusted after recovery dip",
      change_type: "ai",
      target_table: "workouts",
      created_by: "ai",
      created_at: "2026-05-23T08:00:00.000Z",
    };

    const enriched = enrichPlanVersionSummary(
      summary,
      {
        workouts: [
          { id: "w1", date: "2026-05-25", title: "Tempo 8 km", workout_type: "tempo", planned_distance_km: 8, planned_duration_min: 50, planned_rpe: 7 },
        ],
        training_phases: [
          { id: "p1", phase_name: "Build", start_date: "2026-05-18", end_date: "2026-06-14", training_days: 4 },
        ],
      },
      {
        workouts: [
          { id: "w1", date: "2026-05-26", title: "Tempo 8 km", workout_type: "tempo", planned_distance_km: 6, planned_duration_min: 42, planned_rpe: 6 },
          { id: "w2", date: "2026-05-31", title: "Long run 16 km", workout_type: "long_run", planned_distance_km: 16, planned_duration_min: 100, planned_rpe: 4 },
        ],
        training_phases: [
          { id: "p1", phase_name: "Build", start_date: "2026-05-18", end_date: "2026-06-21", training_days: 5 },
        ],
      }
    );

    expect(enriched.impact_summary).toContain("workout changes");
    expect(enriched.highlights?.join(" ")).toContain("moved");
    expect(enriched.changed_workout_count).toBeGreaterThan(0);
    expect(enriched.changed_phase_count).toBeGreaterThan(0);
    expect(enriched.affected_dates).toContain("2026-05-31");
    expect(enriched.change_tags).toContain("added_workouts");
    expect(enriched.change_tags).toContain("moved_workouts");
  });

  it("builds an execution review when a completed workout drifts beyond plan", () => {
    const workout: WorkoutWithLog = {
      id: "w1",
      date: "2026-05-25",
      week_number: 22,
      workout_type: "tempo",
      title: "Tempo 8 km",
      planned_distance_km: 8,
      planned_duration_min: 48,
      planned_pace_text: "5'00\"/km",
      planned_pace_seconds_per_km: 300,
      planned_rpe: 6,
      purpose: null,
      warmup: null,
      main_set: null,
      cooldown: null,
      strength_training: false,
      notes: null,
      completed: true,
      skipped: false,
      log: {
        id: "l1",
        workout_id: "w1",
        date: "2026-05-25",
        completed: true,
        actual_distance_km: 10,
        actual_duration_seconds: 2700,
        actual_pace_text: "4'30\"/km",
        actual_pace_seconds_per_km: 270,
        rpe: 8,
        sleep_hours: null,
        body_weight_kg: null,
        fatigue_level: null,
        pain_area: null,
        pain_score: null,
        weather: null,
        notes: null,
        workouts: null,
      },
    };

    const review = buildWorkoutExecutionReview(workout);
    expect(review?.status).toBe("overreached");
    expect(review?.pattern).toBe("overextended_load");
    expect(review?.pace_delta_seconds_per_km).toBe(-30);
    expect(review?.effort_delta).toBe(2);
  });

  it("recognizes when an easy day was run too fast", () => {
    const workout: WorkoutWithLog = {
      id: "w2",
      date: "2026-05-26",
      week_number: 22,
      workout_type: "easy",
      title: "Easy 6 km",
      planned_distance_km: 6,
      planned_duration_min: 38,
      planned_pace_text: "6'20\"/km",
      planned_pace_seconds_per_km: 380,
      planned_rpe: 3,
      purpose: null,
      warmup: null,
      main_set: null,
      cooldown: null,
      strength_training: false,
      notes: null,
      completed: true,
      skipped: false,
      log: {
        id: "l2",
        workout_id: "w2",
        date: "2026-05-26",
        completed: true,
        actual_distance_km: 6,
        actual_duration_seconds: 2190,
        actual_pace_text: "6'05\"/km",
        actual_pace_seconds_per_km: 365,
        rpe: 5,
        sleep_hours: null,
        body_weight_kg: null,
        fatigue_level: null,
        pain_area: null,
        pain_score: null,
        weather: null,
        notes: null,
        workouts: null,
      },
    };

    const review = buildWorkoutExecutionReview(workout);
    expect(review?.status).toBe("completed_hard");
    expect(review?.pattern).toBe("easy_day_too_fast");
    expect(review?.pattern_label).toBe("Easy day too fast");
  });

  it("builds a quick diff snapshot for AI history cards", () => {
    const snapshot = buildVersionDiffSnapshot({
      id: "v2",
      version_name: "AI adjustment",
      change_reason: "Backed off after costly week",
      change_type: "ai",
      target_table: "workouts",
      created_by: "ai",
      created_at: "2026-05-23T10:00:00.000Z",
      impact_summary: "3 workout changes",
      change_tags: ["moved_workouts", "execution_guardrail"],
      changed_workout_count: 3,
      changed_phase_count: 0,
      affected_dates: ["2026-05-26", "2026-05-28"],
    });

    expect(snapshot.headline).toBe("3 workout changes");
    expect(snapshot.details).toContain("3 workout changes");
    expect(snapshot.details).toContain("Includes moved workout dates");
    expect(snapshot.details).toContain("Adjusted because recent execution was costly");
  });

  it("extracts workout-level before and after changes for explanation cards", () => {
    const version: PlanVersionSummary = {
      id: "v3",
      version_name: "AI safeguard adjustment",
      change_reason: "Backed off after two costly sessions",
      change_type: "ai",
      target_table: "workouts",
      created_by: "ai",
      created_at: "2026-05-23T12:00:00.000Z",
      change_tags: ["moved_workouts", "resized_workouts", "execution_guardrail"],
      before_data: {
        workouts: [
          { id: "w3", date: "2026-05-27", title: "Tempo 8 km", workout_type: "tempo", planned_distance_km: 8, planned_duration_min: 50, planned_rpe: 7, notes: null },
        ],
      },
      after_data: {
        workouts: [
          {
            id: "w3",
            date: "2026-05-28",
            title: "Tempo 8 km",
            workout_type: "tempo",
            planned_distance_km: 6,
            planned_duration_min: 42,
            planned_rpe: 6,
            notes: "Recent execution quality suggested a lighter version this week.",
          },
        ],
      },
    };

    const detail = buildWorkoutVersionChange(version, {
      id: "w3",
      date: "2026-05-28",
      title: "Tempo 8 km",
    });

    expect(detail?.changes).toContain("Date moved from 2026-05-27 to 2026-05-28.");
    expect(detail?.changes).toContain("Distance changed from 8 km to 6 km.");
    expect(detail?.changes).toContain("Duration changed from 50 min to 42 min.");
    expect(detail?.changes).toContain("Planned RPE changed from 7 to 6.");
    expect(detail?.triggers).toContain("Recent execution quality safeguard");
    expect(detail?.triggers).toContain("Backed off after two costly sessions");
  });

  it("builds a full workout change list for a version card", () => {
    const version: PlanVersionSummary = {
      id: "v4",
      version_name: "Weekly reshuffle",
      change_reason: "Moved long run and added recovery day",
      change_type: "ai",
      target_table: "workouts",
      created_by: "ai",
      created_at: "2026-05-23T13:00:00.000Z",
      before_data: {
        workouts: [
          { id: "w4", date: "2026-05-30", title: "Long run 18 km", workout_type: "long_run", planned_distance_km: 18, planned_duration_min: 115, planned_rpe: 5, notes: null },
        ],
      },
      after_data: {
        workouts: [
          { id: "w4", date: "2026-05-31", title: "Long run 16 km", workout_type: "long_run", planned_distance_km: 16, planned_duration_min: 105, planned_rpe: 4, notes: "Adjusted by preference: moved to preferred long-run day." },
          { id: "w5", date: "2026-05-29", title: "Recovery jog 5 km", workout_type: "recovery", planned_distance_km: 5, planned_duration_min: 35, planned_rpe: 2, notes: null },
        ],
      },
    };

    const details = buildVersionWorkoutChanges(version);

    expect(details).toHaveLength(2);
    expect(details[0]?.version_id).toBe("v4");
    expect(details.map((item) => item.workout_title)).toContain("Long run 16 km");
    expect(details.map((item) => item.workout_title)).toContain("Recovery jog 5 km");
  });
});
