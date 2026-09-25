import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbTable } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { enrichPlanVersionSummary } from "@/lib/services/plan-insights";
import type { AISuggestionHistoryItem, PlanVersionSummary } from "@/lib/types/training";

type SuggestionRow = DbTable<"ai_suggestions">;
type PlanVersionRow = DbTable<"plan_versions">;

function asObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function toVersionSummary(row: PlanVersionRow): PlanVersionSummary {
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

function toHistoryItem(row: SuggestionRow, relatedVersions: PlanVersionSummary[]): AISuggestionHistoryItem {
  const relatedWorkouts = Array.from(
    new Map(
      relatedVersions
        .flatMap((version) => {
          const afterData = asObject(version.after_data);
          const workouts = Array.isArray(afterData?.workouts) ? afterData.workouts : [];
          return workouts.flatMap((item) => {
            const workout = asObject(item);
            if (
              !workout ||
              typeof workout.id !== "string" ||
              typeof workout.date !== "string" ||
              typeof workout.title !== "string" ||
              typeof workout.workout_type !== "string"
            ) {
              return [];
            }
            return [
              {
                id: workout.id,
                date: workout.date,
                title: workout.title,
                workout_type: workout.workout_type,
              },
            ];
          });
        })
        .map((workout) => [workout.id, workout] as const)
    ).values()
  );

  return {
    id: row.id,
    suggestion_type: row.suggestion_type,
    suggestion_text: row.suggestion_text,
    risk_level: row.risk_level,
    applied: row.applied,
    created_at: row.created_at,
    applied_at: row.applied_at,
    input_summary: row.input_summary,
    structured_plan: row.structured_plan,
    related_versions: relatedVersions,
    applied_version_id: relatedVersions[0]?.id ?? null,
    affected_dates: Array.from(new Set(relatedVersions.flatMap((version) => version.affected_dates ?? []))),
    related_workouts: relatedWorkouts,
  };
}

export const GET = withApiAuth(async (_request: NextRequest) => {
  const supabase = getSupabaseAdmin();
  const [{ data: suggestionRows, error: suggestionError }, { data: versionRows, error: versionError }] = await Promise.all([
    supabase.from("ai_suggestions").select("*").order("created_at", { ascending: false }).limit(30),
    supabase.from("plan_versions").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  if (suggestionError) throw new Error(`Failed to load AI suggestion history: ${suggestionError.message}`);
  if (versionError) throw new Error(`Failed to load linked plan versions: ${versionError.message}`);

  const versions = ((versionRows ?? []) as PlanVersionRow[]).map(toVersionSummary);
  const versionsBySuggestion = new Map<string, PlanVersionSummary[]>();

  for (const version of versions) {
    if (!version.source_suggestion_id) continue;
    const current = versionsBySuggestion.get(version.source_suggestion_id) ?? [];
    current.push(version);
    versionsBySuggestion.set(version.source_suggestion_id, current);
  }

  return ok({
    suggestions: ((suggestionRows ?? []) as SuggestionRow[]).map((row) => toHistoryItem(row, versionsBySuggestion.get(row.id) ?? [])),
  });
});
