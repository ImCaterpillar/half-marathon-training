import { round1 } from "@/lib/format";
import type {
  PlanVersionSummary,
  RecentPlanAdjustmentSummary,
  VersionChangeTag,
  VersionDiffSnapshot,
  WorkoutExecutionReview,
  WorkoutVersionChange,
  WorkoutWithLog,
} from "@/lib/types/training";

type JsonRecord = Record<string, unknown>;

type WorkoutLike = {
  id: string | null;
  date: string | null;
  title: string | null;
  workout_type: string | null;
  planned_distance_km: number;
  planned_duration_min: number;
  planned_rpe: number | null;
  notes: string | null;
};

type WorkoutLocator = {
  id: string;
  date: string;
  title: string;
};

type PhaseLike = {
  id: string | null;
  phase_name: string | null;
  start_date: string | null;
  end_date: string | null;
  training_days: number | null;
};

function asRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonRecord) : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function toNullableNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function normalizeWorkoutLike(value: unknown): WorkoutLike | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    id: typeof row.id === "string" ? row.id : null,
    date: typeof row.date === "string" ? row.date : null,
    title: typeof row.title === "string" ? row.title : null,
    workout_type: typeof row.workout_type === "string" ? row.workout_type : null,
    planned_distance_km: toNumber(row.planned_distance_km, 0),
    planned_duration_min: toNumber(row.planned_duration_min, 0),
    planned_rpe: toNullableNumber(row.planned_rpe),
    notes: typeof row.notes === "string" ? row.notes : null,
  };
}

function normalizePhaseLike(value: unknown): PhaseLike | null {
  const row = asRecord(value);
  if (!row) return null;
  return {
    id: typeof row.id === "string" ? row.id : null,
    phase_name: typeof row.phase_name === "string" ? row.phase_name : null,
    start_date: typeof row.start_date === "string" ? row.start_date : null,
    end_date: typeof row.end_date === "string" ? row.end_date : null,
    training_days: toNullableNumber(row.training_days),
  };
}

function collectNamedRows(data: unknown, key: "workouts" | "training_phases") {
  const record = asRecord(data);
  if (record?.[key]) return asArray(record[key]);
  return asArray(data);
}

function collectWorkouts(data: unknown) {
  return collectNamedRows(data, "workouts").map(normalizeWorkoutLike).filter((item): item is WorkoutLike => Boolean(item));
}

function collectPhases(data: unknown) {
  return collectNamedRows(data, "training_phases").map(normalizePhaseLike).filter((item): item is PhaseLike => Boolean(item));
}

function workoutKey(workout: WorkoutLike) {
  return workout.id ?? `${workout.date ?? "unknown"}::${workout.title ?? "untitled"}`;
}

function findMatchingWorkout(workouts: WorkoutLike[], locator: WorkoutLocator) {
  return (
    workouts.find((workout) => workout.id === locator.id) ??
    workouts.find((workout) => workout.date === locator.date && workout.title === locator.title) ??
    workouts.find((workout) => workout.title === locator.title) ??
    null
  );
}

function phaseKey(phase: PhaseLike) {
  return phase.id ?? `${phase.phase_name ?? "phase"}::${phase.start_date ?? "unknown"}`;
}

function buildWorkoutHighlights(beforeWorkouts: WorkoutLike[], afterWorkouts: WorkoutLike[]) {
  const beforeMap = new Map(beforeWorkouts.map((workout) => [workoutKey(workout), workout]));
  const afterMap = new Map(afterWorkouts.map((workout) => [workoutKey(workout), workout]));
  const added: string[] = [];
  const removed: string[] = [];
  const moved: string[] = [];
  const resized: string[] = [];
  const preferenceAdjusted: string[] = [];
  const executionGuardrail: string[] = [];

  for (const [key, afterWorkout] of afterMap.entries()) {
    const beforeWorkout = beforeMap.get(key);
    if (!beforeWorkout) {
      added.push(afterWorkout.title ?? afterWorkout.date ?? "Added workout");
      continue;
    }

    if (beforeWorkout.date !== afterWorkout.date) {
      moved.push(`${afterWorkout.title ?? "Workout"} moved to ${afterWorkout.date ?? "new date"}`);
    }

    const distanceChanged = Math.abs(beforeWorkout.planned_distance_km - afterWorkout.planned_distance_km) >= 0.1;
    const durationChanged = Math.abs(beforeWorkout.planned_duration_min - afterWorkout.planned_duration_min) >= 5;
    const effortChanged = beforeWorkout.planned_rpe !== afterWorkout.planned_rpe;
    if (distanceChanged || durationChanged || effortChanged) {
      const changes: string[] = [];
      if (distanceChanged) changes.push(`${round1(beforeWorkout.planned_distance_km)} to ${round1(afterWorkout.planned_distance_km)} km`);
      if (durationChanged) changes.push(`${beforeWorkout.planned_duration_min} to ${afterWorkout.planned_duration_min} min`);
      if (effortChanged && afterWorkout.planned_rpe !== null) changes.push(`RPE ${beforeWorkout.planned_rpe ?? "?"} to ${afterWorkout.planned_rpe}`);
      resized.push(`${afterWorkout.title ?? "Workout"} adjusted: ${changes.join(", ")}`);
    }

    if (afterWorkout.notes?.includes("Adjusted by preference") || afterWorkout.notes?.includes("Preference")) {
      preferenceAdjusted.push(afterWorkout.title ?? afterWorkout.date ?? "Preference-adjusted workout");
    }

    if (
      afterWorkout.notes?.includes("最近 7 天执行质量") ||
      afterWorkout.notes?.includes("Recent execution quality") ||
      afterWorkout.notes?.includes("execution quality")
    ) {
      executionGuardrail.push(afterWorkout.title ?? afterWorkout.date ?? "Execution-guarded workout");
    }
  }

  for (const [key, beforeWorkout] of beforeMap.entries()) {
    if (!afterMap.has(key)) removed.push(beforeWorkout.title ?? beforeWorkout.date ?? "Removed workout");
  }

  return {
    added,
    removed,
    moved,
    resized,
    preferenceAdjusted,
    executionGuardrail,
    changedCount: new Set([
      ...added,
      ...removed,
      ...moved,
      ...resized,
      ...preferenceAdjusted,
      ...executionGuardrail,
    ]).size,
    affectedDates: Array.from(
      new Set(
        [...beforeWorkouts, ...afterWorkouts]
          .map((workout) => workout.date)
          .filter((value): value is string => Boolean(value))
      )
    ).sort(),
  };
}

function buildPhaseHighlights(beforePhases: PhaseLike[], afterPhases: PhaseLike[]) {
  const beforeMap = new Map(beforePhases.map((phase) => [phaseKey(phase), phase]));
  const afterMap = new Map(afterPhases.map((phase) => [phaseKey(phase), phase]));
  const highlights: string[] = [];

  for (const [key, afterPhase] of afterMap.entries()) {
    const beforePhase = beforeMap.get(key);
    if (!beforePhase) {
      highlights.push(`Added phase ${afterPhase.phase_name ?? "new phase"}`);
      continue;
    }

    if (beforePhase.start_date !== afterPhase.start_date || beforePhase.end_date !== afterPhase.end_date) {
      highlights.push(
        `${afterPhase.phase_name ?? "Phase"} window updated to ${afterPhase.start_date ?? "?"} - ${afterPhase.end_date ?? "?"}`
      );
    }

    if (beforePhase.training_days !== afterPhase.training_days && afterPhase.training_days !== null) {
      highlights.push(
        `${afterPhase.phase_name ?? "Phase"} training days changed from ${beforePhase.training_days ?? "?"} to ${afterPhase.training_days}`
      );
    }
  }

  for (const [key, beforePhase] of beforeMap.entries()) {
    if (!afterMap.has(key)) highlights.push(`Removed phase ${beforePhase.phase_name ?? "phase"}`);
  }

  return {
    highlights,
    changedCount: highlights.length,
  };
}

export function enrichPlanVersionSummary(summary: PlanVersionSummary, beforeData: unknown, afterData: unknown): PlanVersionSummary {
  const workoutDiff = buildWorkoutHighlights(collectWorkouts(beforeData), collectWorkouts(afterData));
  const phaseDiff = buildPhaseHighlights(collectPhases(beforeData), collectPhases(afterData));
  const changeTags: VersionChangeTag[] = [];

  if (workoutDiff.added.length > 0) changeTags.push("added_workouts");
  if (workoutDiff.removed.length > 0) changeTags.push("removed_workouts");
  if (workoutDiff.moved.length > 0) changeTags.push("moved_workouts");
  if (workoutDiff.resized.length > 0) changeTags.push("resized_workouts");
  if (workoutDiff.preferenceAdjusted.length > 0) changeTags.push("preference_adjusted");
  if (workoutDiff.executionGuardrail.length > 0) changeTags.push("execution_guardrail");
  if (phaseDiff.highlights.length > 0) changeTags.push("phase_window_changed");

  const highlights = [
    ...workoutDiff.added.slice(0, 2).map((item) => `Added: ${item}`),
    ...workoutDiff.removed.slice(0, 2).map((item) => `Removed: ${item}`),
    ...workoutDiff.moved.slice(0, 2),
    ...workoutDiff.resized.slice(0, 2),
    ...workoutDiff.preferenceAdjusted.slice(0, 2).map((item) => `Preference-adjusted: ${item}`),
    ...workoutDiff.executionGuardrail.slice(0, 2).map((item) => `Execution guardrail: ${item}`),
    ...phaseDiff.highlights.slice(0, 3),
  ].slice(0, 6);

  let impactSummary = "No major plan differences were detected.";
  if (workoutDiff.changedCount > 0 || phaseDiff.changedCount > 0) {
    const segments: string[] = [];
    if (workoutDiff.changedCount > 0) segments.push(`${workoutDiff.changedCount} workout changes`);
    if (phaseDiff.changedCount > 0) segments.push(`${phaseDiff.changedCount} phase updates`);
    impactSummary = segments.join(" and ");
  }

  return {
    ...summary,
    impact_summary: impactSummary,
    highlights,
    change_tags: changeTags,
    changed_workout_count: workoutDiff.changedCount,
    changed_phase_count: phaseDiff.changedCount,
    affected_dates: workoutDiff.affectedDates.slice(0, 6),
  };
}

export function buildVersionDiffSnapshot(version: PlanVersionSummary): VersionDiffSnapshot {
  const details: string[] = [];

  if ((version.changed_workout_count ?? 0) > 0) {
    details.push(`${version.changed_workout_count} workout changes`);
  }
  if ((version.changed_phase_count ?? 0) > 0) {
    details.push(`${version.changed_phase_count} phase updates`);
  }
  if (version.change_tags?.includes("moved_workouts")) {
    details.push("Includes moved workout dates");
  }
  if (version.change_tags?.includes("resized_workouts")) {
    details.push("Includes load or duration changes");
  }
  if (version.change_tags?.includes("preference_adjusted")) {
    details.push("Respects training preferences");
  }
  if (version.change_tags?.includes("execution_guardrail")) {
    details.push("Adjusted because recent execution was costly");
  }
  if (version.affected_dates && version.affected_dates.length > 0) {
    details.push(`Touches ${version.affected_dates.slice(0, 3).join(", ")}`);
  }

  return {
    headline: version.impact_summary ?? "Plan snapshot updated.",
    details: details.slice(0, 4),
  };
}

function summarizeTrigger(tag: VersionChangeTag) {
  switch (tag) {
    case "moved_workouts":
      return "Moved to a different day";
    case "resized_workouts":
      return "Load or duration was resized";
    case "preference_adjusted":
      return "Training preference constraint";
    case "execution_guardrail":
      return "Recent execution quality safeguard";
    case "added_workouts":
      return "Added by a plan revision";
    case "removed_workouts":
      return "Removed by a plan revision";
    case "phase_window_changed":
      return "Part of a wider phase adjustment";
    default:
      return "Plan revision";
  }
}

function toWorkoutPlanSnapshot(workout: WorkoutLike | null) {
  if (!workout) return null;
  return {
    date: workout.date,
    planned_distance_km: workout.planned_distance_km,
    planned_duration_min: workout.planned_duration_min,
    planned_rpe: workout.planned_rpe,
    notes: workout.notes,
  };
}

function collectChangeLines(beforeWorkout: WorkoutLike | null, afterWorkout: WorkoutLike | null) {
  if (!beforeWorkout && !afterWorkout) return [];
  if (!beforeWorkout && afterWorkout) {
    return [`Added to the plan for ${afterWorkout.date ?? "a new day"}.`];
  }
  if (beforeWorkout && !afterWorkout) {
    return [`Removed from the plan after ${beforeWorkout.date ?? "the original date"}.`];
  }

  const changes: string[] = [];
  if (beforeWorkout?.date !== afterWorkout?.date) {
    changes.push(`Date moved from ${beforeWorkout?.date ?? "unknown"} to ${afterWorkout?.date ?? "unknown"}.`);
  }
  if (beforeWorkout && afterWorkout && Math.abs(beforeWorkout.planned_distance_km - afterWorkout.planned_distance_km) >= 0.1) {
    changes.push(`Distance changed from ${round1(beforeWorkout.planned_distance_km)} km to ${round1(afterWorkout.planned_distance_km)} km.`);
  }
  if (beforeWorkout && afterWorkout && Math.abs(beforeWorkout.planned_duration_min - afterWorkout.planned_duration_min) >= 1) {
    changes.push(`Duration changed from ${beforeWorkout.planned_duration_min} min to ${afterWorkout.planned_duration_min} min.`);
  }
  if (beforeWorkout?.planned_rpe !== afterWorkout?.planned_rpe) {
    changes.push(`Planned RPE changed from ${beforeWorkout?.planned_rpe ?? "--"} to ${afterWorkout?.planned_rpe ?? "--"}.`);
  }
  if (beforeWorkout?.notes !== afterWorkout?.notes && afterWorkout?.notes) {
    changes.push("Plan notes were updated to reflect the latest adjustment.");
  }
  return changes;
}

export function buildWorkoutVersionChange(version: PlanVersionSummary, locator: WorkoutLocator): WorkoutVersionChange | null {
  const beforeWorkout = findMatchingWorkout(collectWorkouts(version.before_data), locator);
  const afterWorkout = findMatchingWorkout(collectWorkouts(version.after_data), locator);
  if (!beforeWorkout && !afterWorkout) return null;

  const changes = collectChangeLines(beforeWorkout, afterWorkout);
  const noteSource = afterWorkout?.notes ?? beforeWorkout?.notes ?? "";
  const triggerSet = new Set<string>((version.change_tags ?? []).map(summarizeTrigger));
  if (noteSource.includes("Adjusted by preference") || noteSource.includes("Preference")) {
    triggerSet.add("Training preference constraint");
  }
  if (noteSource.includes("Recent execution quality") || noteSource.includes("execution quality")) {
    triggerSet.add("Recent execution quality safeguard");
  }
  if (version.change_reason?.trim()) {
    triggerSet.add(version.change_reason.trim());
  }

  return {
    version_id: version.id,
    version_name: version.version_name,
    workout_id: afterWorkout?.id ?? beforeWorkout?.id ?? null,
    workout_title: afterWorkout?.title ?? beforeWorkout?.title ?? "Workout",
    workout_type: afterWorkout?.workout_type ?? beforeWorkout?.workout_type ?? null,
    created_at: version.created_at,
    change_type: version.change_type,
    change_reason: version.change_reason,
    source_suggestion_type: version.source_suggestion_type ?? null,
    source_suggestion_text: version.source_suggestion_text ?? null,
    before: toWorkoutPlanSnapshot(beforeWorkout),
    after: toWorkoutPlanSnapshot(afterWorkout),
    changes,
    triggers: Array.from(triggerSet).slice(0, 4),
  };
}

export function buildVersionWorkoutChanges(version: PlanVersionSummary): WorkoutVersionChange[] {
  const beforeWorkouts = collectWorkouts(version.before_data);
  const afterWorkouts = collectWorkouts(version.after_data);
  const locators = new Map<string, WorkoutLocator>();

  for (const workout of [...beforeWorkouts, ...afterWorkouts]) {
    const key = workoutKey(workout);
    locators.set(key, {
      id: workout.id ?? key,
      date: workout.date ?? "",
      title: workout.title ?? "Workout",
    });
  }

  return Array.from(locators.values())
    .map((locator) => buildWorkoutVersionChange(version, locator))
    .filter((item): item is WorkoutVersionChange => Boolean(item));
}

export function getWorkoutChangeKind(change: WorkoutVersionChange): RecentPlanAdjustmentSummary["kind"] {
  const beforeDate = change.before?.date ?? null;
  const afterDate = change.after?.date ?? null;
  const beforeDistance = change.before?.planned_distance_km ?? null;
  const afterDistance = change.after?.planned_distance_km ?? null;
  const beforeDuration = change.before?.planned_duration_min ?? null;
  const afterDuration = change.after?.planned_duration_min ?? null;
  const beforeRpe = change.before?.planned_rpe ?? null;
  const afterRpe = change.after?.planned_rpe ?? null;

  if (change.triggers.some((trigger) => trigger.includes("safeguard") || trigger.includes("constraint"))) {
    return "guardrail";
  }
  if (
    (beforeDistance !== null && afterDistance !== null && Math.abs(beforeDistance - afterDistance) >= 1) ||
    (beforeDuration !== null && afterDuration !== null && Math.abs(beforeDuration - afterDuration) >= 10) ||
    beforeRpe !== afterRpe
  ) {
    return "resized";
  }
  if (beforeDate !== afterDate) {
    return "moved";
  }
  return "adjusted";
}

export function buildWorkoutExecutionReview(workout: WorkoutWithLog): WorkoutExecutionReview | null {
  const log = workout.log;
  if (!log || !log.completed) return null;

  const plannedDistance = workout.planned_distance_km;
  const actualDistance = log.actual_distance_km;
  const plannedDurationMin = workout.planned_duration_min;
  const actualDurationMin = round1(log.actual_duration_seconds / 60);
  const plannedPace = workout.planned_pace_seconds_per_km;
  const actualPace = log.actual_pace_seconds_per_km;
  const plannedRpe = workout.planned_rpe;
  const actualRpe = log.rpe;

  const distanceDelta = round1(actualDistance - plannedDistance);
  const durationDelta = round1(actualDurationMin - plannedDurationMin);
  const paceDelta = plannedPace !== null && actualPace !== null ? Math.round(actualPace - plannedPace) : null;
  const effortDelta = plannedRpe !== null && actualRpe !== null ? actualRpe - plannedRpe : null;

  const shortened = plannedDistance > 0 && actualDistance < plannedDistance * 0.85;
  const overreached =
    (paceDelta !== null && paceDelta <= -20 && (effortDelta ?? 0) >= 2) ||
    (distanceDelta >= Math.max(2, plannedDistance * 0.15) && (effortDelta ?? 0) >= 1);
  const completedHard = !overreached && ((effortDelta ?? 0) >= 2 || (paceDelta !== null && paceDelta >= 20));

  let status: WorkoutExecutionReview["status"] = "on_target";
  let pattern: WorkoutExecutionReview["pattern"] = "well_executed";
  let patternLabel = "Well executed";
  let headline = "Executed close to plan";
  let summary = "Distance, time, and effort stayed close to the planned workout.";
  let recommendation = "Keep the next session as planned if recovery markers stay stable.";

  if (shortened) {
    status = "shortened";
    pattern = workout.workout_type === "long_run" ? "long_run_faded" : "volume_shortfall";
    patternLabel = workout.workout_type === "long_run" ? "Long run faded" : "Volume shortfall";
    headline = "Completed a shortened version";
    summary = "The session was finished, but total volume landed meaningfully below plan.";
    recommendation = "Treat this as a partial completion and avoid compensating with extra volume tomorrow.";
  } else if (overreached) {
    status = "overreached";
    pattern = "overextended_load";
    patternLabel = "Overextended load";
    headline = "Pushed well beyond the intended load";
    summary = "You ran faster or longer than planned while effort also climbed.";
    recommendation = "Use the next run as a recovery session and watch fatigue or soreness.";
  } else if (completedHard) {
    status = "completed_hard";
    if (workout.workout_type === "easy" || workout.workout_type === "recovery") {
      pattern = "easy_day_too_fast";
      patternLabel = "Easy day too fast";
    } else if (workout.workout_type === "tempo" || workout.workout_type === "threshold") {
      pattern = "tempo_costly";
      patternLabel = "Tempo cost too much";
    } else if (workout.workout_type === "interval" || workout.workout_type === "speed") {
      pattern = "interval_costly";
      patternLabel = "Interval cost too much";
    } else if (workout.workout_type === "long_run") {
      pattern = "long_run_faded";
      patternLabel = "Long run faded";
    }
    headline = "Completed, but it cost more than planned";
    summary = "The workout got done, but the effort or pace suggests it was not an easy execution.";
    recommendation = "Hold the next key workout only if sleep, pain, and fatigue settle back down.";
  }

  return {
    status,
    pattern,
    pattern_label: patternLabel,
    headline,
    summary,
    distance_delta_km: distanceDelta,
    duration_delta_min: durationDelta,
    pace_delta_seconds_per_km: paceDelta,
    effort_delta: effortDelta,
    recommendation,
  };
}
