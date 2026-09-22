import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbInsert } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { buildWorkoutLogPayload } from "@/lib/services/workout-log";
import { workoutLogSchema } from "@/lib/validation/workouts";

type Context = { params: Promise<{ id: string }> | { id: string } };

async function getId(context?: unknown) {
  const params = await Promise.resolve((context as Context).params);
  return params.id;
}

export const POST = withApiAuth(async (request: NextRequest, context?: unknown) => {
  const workoutId = await getId(context);
  const input = workoutLogSchema.parse(await request.json());
  const supabase = getSupabaseAdmin() as any;

  const { data: workout, error: workoutError } = await supabase.from("workouts").select("*").eq("id", workoutId).maybeSingle();
  if (workoutError) throw new Error(`读取训练失败: ${workoutError.message}`);
  if (!workout) return fail("NOT_FOUND", "训练不存在。", 404);

  const { data: beforeLog, error: beforeLogError } = await supabase.from("workout_logs").select("*").eq("workout_id", workoutId).maybeSingle();
  if (beforeLogError) throw new Error(`读取原打卡失败: ${beforeLogError.message}`);

  const logPayload = buildWorkoutLogPayload(workoutId, workout.date, input);
  const { data: log, error: logError } = await supabase
    .from("workout_logs")
    .upsert(logPayload, { onConflict: "workout_id" })
    .select("*")
    .single();
  if (logError) throw new Error(`保存打卡失败: ${logError.message}`);

  const { data: updatedWorkout, error: updateWorkoutError } = await supabase
    .from("workouts")
    .update({ completed: input.completed, skipped: !input.completed })
    .eq("id", workoutId)
    .select("*")
    .single();
  if (updateWorkoutError) throw new Error(`更新训练完成状态失败: ${updateWorkoutError.message}`);

  if (input.body_weight_kg) {
    await supabase.from("profile").update({ current_weight_kg: input.body_weight_kg }).neq("id", "00000000-0000-0000-0000-000000000000");
  }

  const shouldCreateRecoveryReminder =
    (input.pain_score ?? 0) > 0 ||
    (input.fatigue_level ?? 0) >= 4 ||
    (input.sleep_hours !== null && input.sleep_hours !== undefined && input.sleep_hours < 6);

  if (shouldCreateRecoveryReminder) {
    const reminderMessage = `训练 ${workout.title} 后恢复提醒：关注睡眠、疲劳和疼痛变化，必要时降低下一次训练强度。`;
    const { data: existingReminder } = await supabase
      .from("reminders")
      .select("id")
      .eq("reminder_type", "recovery")
      .eq("message", reminderMessage)
      .limit(1)
      .maybeSingle();

    if (!existingReminder) {
      const reminderEntry: DbInsert<"reminders"> = {
        reminder_type: "recovery",
        enabled: true,
        reminder_time: null,
        message: reminderMessage,
      };
      await supabase.from("reminders").insert(reminderEntry);
    }
  }

  const auditEntry: DbInsert<"audit_logs"> = {
    action_type: beforeLog ? "update_workout_log" : "create_workout_log",
    target_table: "workout_logs",
    target_id: log.id,
    before_data: beforeLog,
    after_data: log,
    source: "manual",
    notes: beforeLog ? "重复打卡已覆盖原记录" : "首次完成训练打卡",
  };
  await supabase.from("audit_logs").insert(auditEntry);

  return ok({ workout: updatedWorkout, log }, beforeLog ? "打卡已更新" : "打卡已保存");
});
