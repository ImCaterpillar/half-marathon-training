import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { bodyMetricSchema, rangeQuerySchema } from "@/lib/validation/advanced";
import { toNumber } from "@/lib/format";

export const GET = withApiAuth(async (request: NextRequest) => {
  const query = rangeQuerySchema.parse(Object.fromEntries(request.nextUrl.searchParams));
  const supabase = getSupabaseAdmin() as any;
  let builder = supabase.from("body_metrics").select("*").order("date", { ascending: false }).limit(query.limit ?? 120);
  if (query.start) builder = builder.gte("date", query.start);
  if (query.end) builder = builder.lte("date", query.end);
  const { data, error } = await builder;
  if (error) throw new Error(`读取体重恢复记录失败: ${error.message}`);
  const normalized = ((data ?? []) as any[]).map((row) => ({
    ...row,
    weight_kg: toNumber(row.weight_kg),
    sleep_hours: row.sleep_hours == null ? null : toNumber(row.sleep_hours),
    fatigue_level: row.fatigue_level == null ? null : toNumber(row.fatigue_level),
    pain_score: row.pain_score == null ? null : toNumber(row.pain_score),
    resting_hr: row.resting_hr == null ? null : toNumber(row.resting_hr),
    recovery_score: row.recovery_score == null ? null : toNumber(row.recovery_score),
  }));
  return ok({ metrics: normalized });
});

export const POST = withApiAuth(async (request: NextRequest) => {
  const input = bodyMetricSchema.parse(await request.json());
  const supabase = getSupabaseAdmin() as any;
  const { data, error } = await supabase.from("body_metrics").insert(input).select("*").single();
  if (error) throw new Error(`保存体重恢复记录失败: ${error.message}`);
  await supabase.from("profile").update({ current_weight_kg: input.weight_kg }).neq("id", "00000000-0000-0000-0000-000000000000");
  await supabase.from("audit_logs").insert({
    action_type: "create_body_metric",
    target_table: "body_metrics",
    target_id: data.id,
    before_data: null,
    after_data: data,
    source: "manual",
    notes: "Checkpoint 4 记录体重与恢复数据",
  });
  return ok(data, "体重恢复记录已保存", 201);
});
