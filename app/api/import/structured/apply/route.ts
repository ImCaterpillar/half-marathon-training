import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { parseStructuredWorkoutExport } from "@/lib/services/structured-export";

export const POST = withApiAuth(async (request: NextRequest) => {
  const payload = await request.json();
  const parsed = parseStructuredWorkoutExport(payload);

  if (!parsed.valid) {
    return fail("INVALID_STRUCTURED_EXPORT", "Structured workout export validation failed.", 422, parsed.errors);
  }

  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase.rpc("apply_workout_csv_import", {
    p_rows: parsed.rows,
    p_change_reason: "Apply structured workout export import",
  });

  if (error) return fail("STRUCTURED_IMPORT_FAILED", `Structured workout import failed: ${error.message}`, 400);
  return ok(data, "Structured workout import applied and backed up.");
});
