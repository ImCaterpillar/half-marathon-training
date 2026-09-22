import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbInsert } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { buildWorkoutLogPayload } from "@/lib/services/workout-log";
import { resolveOfflineConflictSchema } from "@/lib/validation/settings";
import { workoutLogSchema } from "@/lib/validation/workouts";

export const POST = withApiAuth(async (request: NextRequest) => {
  const input = resolveOfflineConflictSchema.parse(await request.json());
  const supabase = getSupabaseAdmin() as any;

  const { data: workout, error: workoutError } = await supabase.from("workouts").select("*").eq("id", input.workoutId).maybeSingle();
  if (workoutError) throw new Error(`读取训练失败: ${workoutError.message}`);
  if (!workout) return fail("NOT_FOUND", "训练不存在。", 404);

  const { data: beforeLog, error: beforeError } = await supabase.from("workout_logs").select("*").eq("workout_id", input.workoutId).maybeSingle();
  if (beforeError) throw new Error(`读取云端打卡失败: ${beforeError.message}`);

  if (input.mode === "keep_cloud") {
    const auditEntry: DbInsert<"audit_logs"> = {
      action_type: "resolve_offline_conflict_keep_cloud",
      target_table: "workout_logs",
      target_id: beforeLog?.id ?? null,
      before_data: beforeLog,
      after_data: beforeLog,
      source: "manual",
      notes: "PWA 离线打卡冲突处理：保留云端",
    };
    await supabase.from("audit_logs").insert(auditEntry);
    return ok({ mode: input.mode }, "已保留云端打卡");
  }

  const payloadSource = input.pendingPayload ?? input.payload;
  const parsedLog = workoutLogSchema.parse(payloadSource);
  let payload = buildWorkoutLogPayload(input.workoutId, workout.date, parsedLog);

  if (input.mode === "merge_notes") {
    const offlineNotes = typeof payload.notes === "string" ? payload.notes : "";
    const cloudNotes = typeof beforeLog?.notes === "string" ? beforeLog.notes : "";
    payload = {
      ...payload,
      notes: [offlineNotes ? `离线备注：${offlineNotes}` : "", cloudNotes ? `云端备注：${cloudNotes}` : ""]
        .filter(Boolean)
        .join("\n\n") || null,
    };
  }

  const { data: log, error: logError } = await supabase.from("workout_logs").upsert(payload, { onConflict: "workout_id" }).select("*").single();
  if (logError) throw new Error(`写入打卡失败: ${logError.message}`);

  await supabase.from("workouts").update({ completed: parsedLog.completed, skipped: !parsedLog.completed }).eq("id", input.workoutId);

  const auditEntry: DbInsert<"audit_logs"> = {
    action_type: input.mode === "merge_notes" ? "resolve_offline_conflict_merge_notes" : "resolve_offline_conflict_overwrite_cloud",
    target_table: "workout_logs",
    target_id: log.id,
    before_data: beforeLog,
    after_data: log,
    source: "manual",
    notes: "PWA 离线打卡冲突已按用户选择完成处理",
  };
  await supabase.from("audit_logs").insert(auditEntry);

  return ok({ mode: input.mode, log }, "离线冲突已处理");
});
