import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbTable } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { parseWorkoutCsv } from "@/lib/services/csv";
import { csvPreviewSchema } from "@/lib/validation/advanced";

type WorkoutConflictRow = Pick<DbTable<"workouts">, "id" | "date" | "workout_type" | "title">;

export const POST = withApiAuth(async (request: NextRequest) => {
  const { csv_text } = csvPreviewSchema.parse(await request.json());
  const preview = parseWorkoutCsv(csv_text);
  const supabase = getSupabaseAdmin();
  const conflicts: Array<{ date: string; workout_type: string; title: string; existing_id: string }> = [];

  for (const row of preview.rows) {
    const { data, error } = await supabase
      .from("workouts")
      .select("id,date,workout_type,title")
      .eq("date", row.date)
      .eq("workout_type", row.workout_type)
      .eq("title", row.title)
      .returns<WorkoutConflictRow | null>()
      .maybeSingle();

    if (error) throw new Error(`Failed to preview CSV conflicts: ${error.message}`);
    const conflict = data as WorkoutConflictRow | null;
    if (conflict) {
      conflicts.push({
        date: conflict.date,
        workout_type: conflict.workout_type,
        title: conflict.title,
        existing_id: conflict.id,
      });
    }
  }

  return ok({
    valid: preview.errors.length === 0,
    rows: preview.rows,
    errors: preview.errors,
    preview: {
      will_create: Math.max(0, preview.rows.length - conflicts.length),
      will_update: conflicts.length,
      will_delete: 0,
      will_create_version_backup: true,
      rollback: "A backup entry will be written to plan_versions before the CSV import is applied.",
    },
    conflicts,
  });
});
