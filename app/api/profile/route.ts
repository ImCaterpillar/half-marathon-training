import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbInsert } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { fetchProfile } from "@/lib/services/training-data";
import { profileUpdateSchema } from "@/lib/validation/settings";

export const GET = withApiAuth(async () => {
  const profile = await fetchProfile();
  return ok(profile);
});

export const PUT = withApiAuth(async (request: NextRequest) => {
  const input = profileUpdateSchema.parse(await request.json());
  const supabase = getSupabaseAdmin() as any;
  const { data: before } = await supabase.from("profile").select("*").limit(1).maybeSingle();

  if (!before) {
    return fail("NOT_FOUND", "个人资料不存在，请先执行 seed。", 404);
  }

  const { data, error } = await supabase.from("profile").update(input).eq("id", before.id).select("*").single();
  if (error) throw new Error(`更新个人资料失败: ${error.message}`);

  const auditEntry: DbInsert<"audit_logs"> = {
    action_type: "update_profile",
    target_table: "profile",
    target_id: data.id,
    before_data: before,
    after_data: data,
    source: "manual",
    notes: "设置页更新个人资料",
  };
  await supabase.from("audit_logs").insert(auditEntry);

  return ok(data, "个人资料已更新");
});
