import { describe, expect, it } from "vitest";
import { buildReadinessSummary, buildRecentExecutionQualitySummary, buildTodayBrief, buildWeeklySummary } from "@/lib/services/training-data";
import type { BodySummary, RiskResult, TrainingPhase, WorkoutWithLog } from "@/lib/types/training";

const greenRisk: RiskResult = {
  risk_level: "green",
  reasons: ["Recent training and recovery look stable."],
  recommended_action: "Continue as planned",
  should_modify_today: false,
};

describe("dashboard briefs", () => {
  it("builds a recovery-oriented brief when risk is high", () => {
    const workout: WorkoutWithLog = {
      id: "w1",
      date: "2026-05-23",
      week_number: 1,
      workout_type: "tempo",
      title: "Tempo Run",
      planned_distance_km: 8,
      planned_duration_min: 45,
      planned_pace_text: "5'20/km",
      planned_pace_seconds_per_km: 320,
      planned_rpe: 7,
      purpose: "Build half-marathon specific strength",
      warmup: null,
      main_set: "2 x 10 min tempo",
      cooldown: null,
      strength_training: false,
      notes: null,
      completed: false,
      skipped: false,
      log: null,
    };

    const brief = buildTodayBrief({
      primaryWorkout: workout,
      todayStatus: "pending",
      risk: {
        risk_level: "orange",
        reasons: ["Sleep has dropped", "Fatigue is rising"],
        recommended_action: "Replace the hard session with a recovery run",
        should_modify_today: true,
      },
      aiTodayAdvice: "If the legs still feel heavy, shorten the main set.",
    });

    expect(brief.should_modify_today).toBe(true);
    expect(brief.modified_workout_label).toContain("恢复");
    expect(brief.recommendation).toContain("Replace the hard session");
  });

  it("builds readiness and weekly summary with plain-language coaching", () => {
    const body: BodySummary = {
      current_weight_kg: 63,
      target_weight_min_kg: 60,
      target_weight_max_kg: 62,
      latest_sleep_hours: 5.5,
      latest_fatigue_level: 8,
      latest_pain_area: "calf",
      latest_pain_score: 4,
    };

    const readiness = buildReadinessSummary(body, {
      risk_level: "red",
      reasons: ["Pain score is too high"],
      recommended_action: "Pause running for recovery",
      should_modify_today: true,
    });

    expect(readiness.recommendation).toContain("暂停");

    const phase: TrainingPhase = {
      id: "phase-1",
      phase_name: "Specific Build",
      start_date: "2026-05-01",
      end_date: "2026-06-01",
      goal: "Build specific half-marathon ability",
      weekly_mileage_min: 40,
      weekly_mileage_max: 55,
      training_days: 5,
      key_workouts: null,
      test_standard: null,
      ai_notes: null,
    };

    const workouts: WorkoutWithLog[] = [
      {
        id: "w1",
        date: "2026-05-23",
        week_number: 1,
        workout_type: "easy",
        title: "Easy Run",
        planned_distance_km: 6,
        planned_duration_min: 38,
        planned_pace_text: null,
        planned_pace_seconds_per_km: null,
        planned_rpe: 4,
        purpose: null,
        warmup: null,
        main_set: null,
        cooldown: null,
        strength_training: false,
        notes: null,
        completed: false,
        skipped: false,
        log: null,
      },
      {
        id: "w2",
        date: "2026-05-24",
        week_number: 1,
        workout_type: "long_run",
        title: "Long Run 16 km",
        planned_distance_km: 16,
        planned_duration_min: 95,
        planned_pace_text: null,
        planned_pace_seconds_per_km: null,
        planned_rpe: 6,
        purpose: null,
        warmup: null,
        main_set: null,
        cooldown: null,
        strength_training: false,
        notes: null,
        completed: false,
        skipped: false,
        log: null,
      },
    ];

    const summary = buildWeeklySummary({
      weekWorkouts: workouts,
      currentPhase: phase,
      risk: greenRisk,
      preferenceSummary: "Train 5 days per week with the long run on Sunday.",
      today: "2026-05-23",
    });

    expect(summary.next_key_workout).toContain("Easy Run");
    expect(summary.completion_trend).toContain("完成率");
    expect(summary.preference_summary).toContain("Sunday");
  });

  it("summarizes the last 7 days of execution quality", () => {
    const workouts: WorkoutWithLog[] = [
      {
        id: "w1",
        date: "2026-05-21",
        week_number: 1,
        workout_type: "easy",
        title: "Easy 6 km",
        planned_distance_km: 6,
        planned_duration_min: 38,
        planned_pace_text: null,
        planned_pace_seconds_per_km: 380,
        planned_rpe: 4,
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
          date: "2026-05-21",
          completed: true,
          actual_distance_km: 6,
          actual_duration_seconds: 2280,
          actual_pace_text: null,
          actual_pace_seconds_per_km: 380,
          rpe: 4,
          sleep_hours: null,
          body_weight_kg: null,
          fatigue_level: null,
          pain_area: null,
          pain_score: null,
          weather: null,
          notes: null,
          workouts: null,
        },
      },
      {
        id: "w2",
        date: "2026-05-22",
        week_number: 1,
        workout_type: "tempo",
        title: "Tempo 8 km",
        planned_distance_km: 8,
        planned_duration_min: 48,
        planned_pace_text: null,
        planned_pace_seconds_per_km: 360,
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
          id: "l2",
          workout_id: "w2",
          date: "2026-05-22",
          completed: true,
          actual_distance_km: 10,
          actual_duration_seconds: 3300,
          actual_pace_text: null,
          actual_pace_seconds_per_km: 330,
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
      },
    ];

    const summary = buildRecentExecutionQualitySummary(workouts);
    expect(summary.quality_score).toBeGreaterThan(0);
    expect(summary.counts.on_target).toBe(1);
    expect(summary.counts.overreached).toBe(1);
    expect(summary.summary.length).toBeGreaterThan(10);
  });
});
