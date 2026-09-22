import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { previewBackupPayload } from "@/lib/services/backup";
import { jsonApplySchema } from "@/lib/validation/advanced";

export const POST = withApiAuth(async (request: NextRequest) => {
  const input = jsonApplySchema.parse(await request.json());
  const preview = previewBackupPayload(input.payload);
  if (!preview.valid) return fail("INVALID_JSON_BACKUP", "JSON backup validation failed.", 422, preview.errors);
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase.rpc("restore_json_backup", {
    p_payload: input.payload,
    p_change_reason: input.change_reason ?? "Restore full plan from JSON backup",
  });
  if (error) return fail("JSON_RESTORE_FAILED", `JSON restore failed: ${error.message}`, 400);
  return ok(data, "JSON backup restored and previous state archived.");
});
