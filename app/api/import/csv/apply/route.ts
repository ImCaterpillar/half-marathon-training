import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { csvApplySchema } from "@/lib/validation/advanced";
import { workoutCreateSchema } from "@/lib/validation/workouts";

export const POST = withApiAuth(async (request: NextRequest) => {
  const input = csvApplySchema.parse(await request.json());
  const rows = input.rows.map((row) =>
    workoutCreateSchema.omit({ completed: true, skipped: true }).parse({ ...row, planned_pace_seconds_per_km: undefined })
  );
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("apply_workout_csv_import", {
    p_rows: rows,
    p_change_reason: input.change_reason ?? "Apply workout CSV import",
  });
  if (error) return fail("CSV_IMPORT_FAILED", `CSV import failed: ${error.message}`, 400);
  return ok(data, "CSV import applied and backed up.");
});
