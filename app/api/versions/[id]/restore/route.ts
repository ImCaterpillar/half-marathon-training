import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { restoreVersionSchema } from "@/lib/validation/advanced";

type Context = { params: Promise<{ id: string }> | { id: string } };
async function getId(context?: unknown) {
  const params = await Promise.resolve((context as Context).params);
  return params.id;
}

export const POST = withApiAuth(async (request: NextRequest, context?: unknown) => {
  const id = await getId(context);
  const input = restoreVersionSchema.parse(await request.json());
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.rpc("restore_plan_version", {
    p_version_id: id,
    p_change_reason: input.change_reason ?? "用户确认恢复历史版本",
  });
  if (error) return fail("RESTORE_VERSION_FAILED", `恢复版本失败，数据库已回滚：${error.message}`, 400);
  return ok(data, "历史版本已恢复，恢复前已自动创建当前版本备份");
});
