import "server-only";
import type { DbTable, Json } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { buildWorkoutExecutionReview, buildWorkoutVersionChange, enrichPlanVersionSummary } from "@/lib/services/plan-insights";
import type { AISuggestionSummary, PlanVersionSummary, WorkoutExplanation, WorkoutWithLog } from "@/lib/types/training";

type PlanVersionRow = DbTable<"plan_versions">;
type AuditLogRow = DbTable<"audit_logs">;
type AISuggestionRow = DbTable<"ai_suggestions">;

function asObject(value: Json | null | undefined) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, Json | undefined>) : null;
}

function asArray(value: Json | null | undefined) {
  return Array.isArray(value) ? value : [];
}

function parseVersionSummary(row: PlanVersionRow): PlanVersionSummary {
  const afterData = asObject(row.after_data);
  return enrichPlanVersionSummary(
    {
      id: row.id,
      version_name: row.version_name,
      change_reason: row.change_reason,
      change_type: row.change_type,
      target_table: row.target_table,
      created_by: row.created_by,
      created_at: row.created_at,
      source_suggestion_id: typeof afterData?.source_suggestion_id === "string" ? afterData.source_suggestion_id : null,
      source_suggestion_type: typeof afterData?.source_suggestion_type === "string" ? afterData.source_suggestion_type : null,
      before_data: row.before_data,
      after_data: row.after_data,
    },
    row.before_data,
    row.after_data
  );
}

function workoutMatchesVersion(workout: WorkoutWithLog, version: PlanVersionRow) {
  const before = asObject(version.before_data);
  const after = asObject(version.after_data);
  const workoutLists = [...asArray(before?.workouts), ...asArray(after?.workouts)];

  return workoutLists.some((item) => {
    const row = asObject(item);
    if (!row) return false;
    return row.id === workout.id || (row.date === workout.date && row.title === workout.title);
  });
}

function toSuggestionSummary(row: AISuggestionRow): AISuggestionSummary {
  return {
    id: row.id,
    suggestion_type: row.suggestion_type,
    suggestion_text: row.suggestion_text,
    risk_level: row.risk_level,
    applied: row.applied,
    created_at: row.created_at,
  };
}

function attachSuggestionText(summary: PlanVersionSummary, suggestions: Map<string, AISuggestionRow>) {
  if (!summary.source_suggestion_id) return summary;
  const suggestion = suggestions.get(summary.source_suggestion_id);
  if (!suggestion) return summary;
  return {
    ...summary,
    source_suggestion_text: suggestion.suggestion_text,
  };
}

export async function buildWorkoutExplanation(workout: WorkoutWithLog): Promise<WorkoutExplanation> {
  const supabase = getSupabaseAdmin();

  const [versionResult, auditResult] = await Promise.all([
    supabase.from("plan_versions").select("*").order("created_at", { ascending: false }).limit(30),
    supabase
      .from("audit_logs")
      .select("*")
      .eq("target_table", "workouts")
      .eq("target_id", workout.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  if (versionResult.error) throw new Error(`Failed to load plan versions: ${versionResult.error.message}`);
  if (auditResult.error) throw new Error(`Failed to load workout audit trail: ${auditResult.error.message}`);

  const matchedVersions = ((versionResult.data ?? []) as PlanVersionRow[])
    .filter((version) => workoutMatchesVersion(workout, version))
    .slice(0, 5);
  const parsedVersions = matchedVersions.map(parseVersionSummary);
  const sourceSuggestionId = parsedVersions.find((version) => version.source_suggestion_id)?.source_suggestion_id ?? null;

  let sourceSuggestion: AISuggestionSummary | null = null;
  if (sourceSuggestionId) {
    const { data, error } = await supabase.from("ai_suggestions").select("*").eq("id", sourceSuggestionId).maybeSingle();
    if (error) throw new Error(`Failed to load linked AI suggestion: ${error.message}`);
    if (data) sourceSuggestion = toSuggestionSummary(data as AISuggestionRow);
  }

  const latestAudit = ((auditResult.data ?? []) as AuditLogRow[])[0] ?? null;

  return {
    is_preference_adjusted: Boolean(workout.is_preference_adjusted),
    constraint_reasons: workout.constraint_reasons ?? [],
    latest_audit_note: latestAudit?.notes ?? null,
    recent_versions: parsedVersions,
    source_suggestion: sourceSuggestion,
    execution_review: buildWorkoutExecutionReview(workout),
    change_details: parsedVersions.flatMap((version) => {
      const detail = buildWorkoutVersionChange(version, {
        id: workout.id,
        date: workout.date,
        title: workout.title,
      });
      return detail ? [detail] : [];
    }),
  };
}

export async function fetchRecentPlanTimeline(limit = 8): Promise<PlanVersionSummary[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("plan_versions").select("*").order("created_at", { ascending: false }).limit(limit);

  if (error) throw new Error(`Failed to load plan timeline: ${error.message}`);

  const versions = ((data ?? []) as PlanVersionRow[]).map(parseVersionSummary);
  const suggestionIds = Array.from(
    new Set(versions.map((version) => version.source_suggestion_id).filter((value): value is string => Boolean(value)))
  );

  if (suggestionIds.length === 0) return versions;

  const { data: suggestionRows, error: suggestionError } = await supabase.from("ai_suggestions").select("*").in("id", suggestionIds);
  if (suggestionError) throw new Error(`Failed to load linked AI suggestions: ${suggestionError.message}`);

  const suggestionMap = new Map(((suggestionRows ?? []) as AISuggestionRow[]).map((row) => [row.id, row]));
  return versions.map((version) => attachSuggestionText(version, suggestionMap));
}
