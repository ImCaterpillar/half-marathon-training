import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbInsert } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { toNumber } from "@/lib/format";
import { rangeQuerySchema, testResultSchema } from "@/lib/validation/advanced";

export const GET = withApiAuth(async (request: NextRequest) => {
  const query = rangeQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const supabase = getSupabaseAdmin();
  let builder = supabase.from("test_results").select("*").order("test_date", { ascending: false }).limit(query.limit ?? 100);
  if (query.start) builder = builder.gte("test_date", query.start);
  if (query.end) builder = builder.lte("test_date", query.end);

  const { data, error } = await builder;
  if (error) throw new Error(`读取测试成绩失败: ${error.message}`);

  const normalized = (data ?? []).map((row) => ({
    ...row,
    distance_km: toNumber(row.distance_km),
    result_time_seconds: toNumber(row.result_time_seconds),
    avg_pace_seconds_per_km: toNumber(row.avg_pace_seconds_per_km),
    predicted_half_marathon_seconds: row.predicted_half_marathon_seconds == null ? null : toNumber(row.predicted_half_marathon_seconds),
  }));

  return ok({ tests: normalized });
});

export const POST = withApiAuth(async (request: NextRequest) => {
  const input = testResultSchema.parse(await request.json());
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("test_results").insert(input).select("*").single();
  if (error) throw new Error(`保存测试成绩失败: ${error.message}`);

  const auditEntry: DbInsert<"audit_logs"> = {
    action_type: "create_test_result",
    target_table: "test_results",
    target_id: data.id,
    before_data: null,
    after_data: data,
    source: "manual",
    notes: "记录阶段测试成绩",
  };
  await supabase.from("audit_logs").insert(auditEntry);

  return ok(data, "测试成绩已保存", 201);
});
