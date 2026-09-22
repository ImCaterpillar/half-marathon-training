import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbInsert } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { buildWorkoutExplanation } from "@/lib/services/plan-explanations";
import { fetchWorkoutsWithLogs } from "@/lib/services/training-data";
import { workoutUpdateSchema } from "@/lib/validation/workouts";

type Context = { params: Promise<{ id: string }> | { id: string } };

async function getId(context?: unknown) {
  const params = await Promise.resolve((context as Context).params);
  return params.id;
}

export const GET = withApiAuth(async (_request: NextRequest, context?: unknown) => {
  const id = await getId(context);
  const supabase = getSupabaseAdmin() as any;
  const { data: workout, error } = await supabase.from("workouts").select("date").eq("id", id).maybeSingle();
  if (error) throw new Error(`Failed to load workout date: ${error.message}`);
  if (!workout) return fail("NOT_FOUND", "Workout not found.", 404);

  const workouts = await fetchWorkoutsWithLogs(workout.date, workout.date);
  const data = workouts.find((item) => item.id === id);
  if (!data) return fail("NOT_FOUND", "Workout not found.", 404);

  const explanation = await buildWorkoutExplanation(data);
  return ok({ ...data, explanation });
});

export const PUT = withApiAuth(async (request: NextRequest, context?: unknown) => {
  const id = await getId(context);
  const input = workoutUpdateSchema.parse(await request.json());
  const supabase = getSupabaseAdmin() as any;
  const { data: before, error: beforeError } = await supabase.from("workouts").select("*").eq("id", id).maybeSingle();
  if (beforeError) throw new Error(`Failed to load workout before update: ${beforeError.message}`);
  if (!before) return fail("NOT_FOUND", "Workout not found.", 404);

  const { data, error } = await supabase.from("workouts").update(input).eq("id", id).select("*").single();
  if (error) throw new Error(`Failed to update workout: ${error.message}`);

  const auditEntry: DbInsert<"audit_logs"> = {
    action_type: "update_workout",
    target_table: "workouts",
    target_id: id,
    before_data: before,
    after_data: data,
    source: "manual",
    notes: "Workout updated manually.",
  };
  await supabase.from("audit_logs").insert(auditEntry);

  return ok(data, "Workout updated.");
});

export const DELETE = withApiAuth(async (_request: NextRequest, context?: unknown) => {
  const id = await getId(context);
  const supabase = getSupabaseAdmin() as any;
  const { data: before, error: beforeError } = await supabase.from("workouts").select("*").eq("id", id).maybeSingle();
  if (beforeError) throw new Error(`Failed to load workout before delete: ${beforeError.message}`);
  if (!before) return fail("NOT_FOUND", "Workout not found.", 404);

  const { error } = await supabase.from("workouts").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete workout: ${error.message}`);

  const auditEntry: DbInsert<"audit_logs"> = {
    action_type: "delete_workout",
    target_table: "workouts",
    target_id: id,
    before_data: before,
    after_data: null,
    source: "manual",
    notes: "Workout deleted manually.",
  };
  await supabase.from("audit_logs").insert(auditEntry);

  return ok({ id }, "Workout deleted.");
});
