import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbInsert } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { phaseSchema } from "@/lib/validation/advanced";

export const GET = withApiAuth(async () => {
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase
    .from("training_phases")
    .select("*")
    .order("start_date", { ascending: true });

  if (error) throw new Error(`读取年度训练阶段失败: ${error.message}`);
  return ok({ phases: data ?? [] });
});

export const POST = withApiAuth(async (request: NextRequest) => {
  const input = phaseSchema.parse(await request.json());
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase.from("training_phases").insert(input).select("*").single();
  if (error) throw new Error(`新增训练阶段失败: ${error.message}`);

  const auditEntry: DbInsert<"audit_logs"> = {
    action_type: "create_training_phase",
    target_table: "training_phases",
    target_id: data.id,
    before_data: null,
    after_data: data,
    source: "manual",
    notes: "年度计划新增训练阶段",
  };
  await supabase.from("audit_logs").insert(auditEntry);

  return ok(data, "训练阶段已新增", 201);
});
