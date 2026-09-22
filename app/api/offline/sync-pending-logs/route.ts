import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbInsert } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { buildWorkoutLogPayload } from "@/lib/services/workout-log";
import { syncPendingLogsSchema } from "@/lib/validation/settings";
import { workoutLogSchema } from "@/lib/validation/workouts";

export const POST = withApiAuth(async (request: NextRequest) => {
  const input = syncPendingLogsSchema.parse(await request.json());
  const supabase = getSupabaseAdmin() as any;
  const syncedLocalIds: string[] = [];
  const conflicts: unknown[] = [];
  const failed: Array<{ localId: string; reason: string }> = [];

  for (const pending of input.logs) {
    const { data: workout, error: workoutError } = await supabase.from("workouts").select("*").eq("id", pending.workoutId).maybeSingle();
    if (workoutError || !workout) {
      failed.push({ localId: pending.localId, reason: workoutError?.message ?? "训练不存在" });
      continue;
    }

    const parsedLog = workoutLogSchema.safeParse(pending.payload);
    if (!parsedLog.success) {
      failed.push({ localId: pending.localId, reason: "离线打卡参数无效" });
      continue;
    }

    const { data: existingLog, error: existingError } = await supabase.from("workout_logs").select("*").eq("workout_id", pending.workoutId).maybeSingle();
    if (existingError) {
      failed.push({ localId: pending.localId, reason: existingError.message });
      continue;
    }

    if (existingLog) {
      conflicts.push({
        localId: pending.localId,
        workoutId: pending.workoutId,
        workoutTitle: pending.workoutTitle,
        workoutDate: pending.workoutDate,
        cloudLog: existingLog,
        pendingPayload: pending.payload,
      });
      continue;
    }

    const payload = buildWorkoutLogPayload(pending.workoutId, workout.date, parsedLog.data);
    const { data: log, error: logError } = await supabase.from("workout_logs").upsert(payload, { onConflict: "workout_id" }).select("*").single();
    if (logError) {
      failed.push({ localId: pending.localId, reason: logError.message });
      continue;
    }

    await supabase.from("workouts").update({ completed: parsedLog.data.completed, skipped: !parsedLog.data.completed }).eq("id", pending.workoutId);

    const auditEntry: DbInsert<"audit_logs"> = {
      action_type: "sync_offline_workout_log",
      target_table: "workout_logs",
      target_id: log.id,
      before_data: null,
      after_data: log,
      source: "manual",
      notes: "PWA 离线 pending logs 在网络恢复后已同步入库",
    };
    await supabase.from("audit_logs").insert(auditEntry);

    syncedLocalIds.push(pending.localId);
  }

  return ok({ synced_local_ids: syncedLocalIds, conflicts, failed }, "离线打卡同步处理完成");
});
