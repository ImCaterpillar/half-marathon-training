import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbInsert } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { phaseUpdateSchema } from "@/lib/validation/advanced";

type Context = { params: Promise<{ id: string }> | { id: string } };

async function getId(context?: unknown) {
  const params = await Promise.resolve((context as Context).params);
  return params.id;
}

export const PUT = withApiAuth(async (request: NextRequest, context?: unknown) => {
  const id = await getId(context);
  const input = phaseUpdateSchema.parse(await request.json());
  const supabase = getSupabaseAdmin();

  const { data: before, error: beforeError } = await supabase.from("training_phases").select("*").eq("id", id).maybeSingle();
  if (beforeError) throw new Error(`读取修改前阶段失败: ${beforeError.message}`);
  if (!before) return fail("NOT_FOUND", "训练阶段不存在。", 404);

  const { data, error } = await supabase.from("training_phases").update(input).eq("id", id).select("*").single();
  if (error) throw new Error(`更新训练阶段失败: ${error.message}`);

  const auditEntry: DbInsert<"audit_logs"> = {
    action_type: "update_training_phase",
    target_table: "training_phases",
    target_id: id,
    before_data: before,
    after_data: data,
    source: "manual",
    notes: "年度计划更新训练阶段",
  };
  await supabase.from("audit_logs").insert(auditEntry);

  return ok(data, "训练阶段已更新");
});

export const DELETE = withApiAuth(async (_request: NextRequest, context?: unknown) => {
  const id = await getId(context);
  const supabase = getSupabaseAdmin();

  const { data: before, error: beforeError } = await supabase.from("training_phases").select("*").eq("id", id).maybeSingle();
  if (beforeError) throw new Error(`读取删除前阶段失败: ${beforeError.message}`);
  if (!before) return fail("NOT_FOUND", "训练阶段不存在。", 404);

  const { error } = await supabase.from("training_phases").delete().eq("id", id);
  if (error) throw new Error(`删除训练阶段失败: ${error.message}`);

  const auditEntry: DbInsert<"audit_logs"> = {
    action_type: "delete_training_phase",
    target_table: "training_phases",
    target_id: id,
    before_data: before,
    after_data: null,
    source: "manual",
    notes: "年度计划删除训练阶段",
  };
  await supabase.from("audit_logs").insert(auditEntry);

  return ok({ id }, "训练阶段已删除");
});
