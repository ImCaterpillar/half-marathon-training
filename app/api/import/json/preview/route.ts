import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { previewBackupPayload } from "@/lib/services/backup";
import { jsonPreviewSchema } from "@/lib/validation/advanced";

export const POST = withApiAuth(async (request: NextRequest) => {
  const { payload } = jsonPreviewSchema.parse(await request.json());
  const preview = previewBackupPayload(payload);
  return ok({
    ...preview,
    preview: {
      will_create_version_backup: true,
      will_replace_tables: Object.keys(preview.counts),
      will_delete: "Current tables will be replaced by the uploaded JSON backup payload.",
      rollback: "The pre-restore state is saved into plan_versions so you can restore it again later.",
    },
  });
});
