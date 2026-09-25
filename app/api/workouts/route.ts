import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbInsert } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { fetchWorkoutsWithLogs } from "@/lib/services/training-data";
import { endOfWeekSunday, getTodayDateInTimezone, startOfWeekMonday } from "@/lib/time";
import { workoutCreateSchema, workoutQuerySchema } from "@/lib/validation/workouts";

export const GET = withApiAuth(async (request: NextRequest) => {
  const url = request.nextUrl;
  const parsed = workoutQuerySchema.parse({
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
    date: url.searchParams.get("date") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  const today = getTodayDateInTimezone();
  const start = parsed.date ?? parsed.start ?? startOfWeekMonday(today);
  const end = parsed.date ?? parsed.end ?? endOfWeekSunday(today);
  const workouts = await fetchWorkoutsWithLogs(start, end);

  return ok({ start, end, workouts: parsed.limit ? workouts.slice(0, parsed.limit) : workouts });
});

export const POST = withApiAuth(async (request: NextRequest) => {
  const input = workoutCreateSchema.parse(await request.json());
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("workouts").insert(input).select("*").single();
  if (error) throw new Error(`创建训练失败: ${error.message}`);

  const auditEntry: DbInsert<"audit_logs"> = {
    action_type: "create_workout",
    target_table: "workouts",
    target_id: data.id,
    before_data: null,
    after_data: data,
    source: "manual",
    notes: "周计划新增训练",
  };
  await supabase.from("audit_logs").insert(auditEntry);

  return ok(data, "训练已创建", 201);
});
