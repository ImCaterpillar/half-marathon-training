import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { setTimeout as delay } from "node:timers/promises";
import {
  DEFAULT_SEED_START_DATE,
  generatedPhaseTemplates,
  generatedPlanSourceSummary,
  generatedWorkoutTemplates,
} from "./seed-plan-data";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_TIMEZONE = process.env.APP_TIMEZONE || "Asia/Shanghai";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.");
  process.exit(1);
}

const supabaseUrl = SUPABASE_URL;
const supabaseServiceRoleKey = SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const PROFILE_ID = "11111111-1111-4111-8111-111111111111";
const APP_SETTINGS_ID = "22222222-2222-4222-8222-222222222222";
const SEED_VERSION_ID = "33333333-3333-4333-8333-333333333333";

function parseIsoDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = parseIsoDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

function daysBetween(startDate: string, endDate: string) {
  const start = parseIsoDate(startDate).getTime();
  const end = parseIsoDate(endDate).getTime();
  return Math.round((end - start) / 86_400_000);
}

function fixedPhaseId(index: number) {
  return `44444444-4444-4444-8444-${String(index).padStart(12, "0")}`;
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    const cause = error.cause instanceof Error ? ` | cause: ${error.cause.message}` : "";
    return `${error.name}: ${error.message}${cause}`;
  }
  return String(error);
}

async function withRetry<T>(label: string, task: () => Promise<T>, retries = 3) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await task();
    } catch (error) {
      lastError = error;
      const retryable = error instanceof TypeError || (error instanceof Error && /fetch failed/i.test(error.message));
      if (!retryable || attempt === retries) break;
      console.warn(`${label} attempt ${attempt}/${retries} failed: ${formatError(error)}. Retrying...`);
      await delay(1000 * attempt);
    }
  }
  throw lastError;
}

async function verifySupabaseConnection() {
  const healthUrl = new URL("/rest/v1/", supabaseUrl);
  const response = await fetch(healthUrl, {
    method: "GET",
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Supabase connectivity check failed with ${response.status} ${response.statusText}: ${body.slice(0, 300)}`);
  }
}

async function upsertOrThrow(table: string, payload: unknown, onConflict?: string) {
  const { error } = await withRetry(`${table} upsert`, async () => {
    // 表名在运行期决定，无法在编译期收敛为单一表类型；upsert 的入参在此按调用方约定处理
    const query = supabase.from(table).upsert(payload as never, onConflict ? { onConflict } : undefined);
    return query;
  });
  if (error) throw new Error(`${table} upsert failed: ${error.message}`);
}

async function optionallyReplaceUnloggedSeedWindow(seedStart: string) {
  if (process.env.SEED_REPLACE_EXISTING_PLAN !== "true") return;

  const startDate = seedStart;
  const endDate = addDays(seedStart, 83);
  const { data: logs, error: logError } = await supabase
    .from("workout_logs")
    .select("workout_id")
    .gte("date", startDate)
    .lte("date", endDate);

  if (logError) throw new Error(`read existing workout logs failed: ${logError.message}`);

  const loggedIds = Array.from(new Set((logs ?? []).map((row) => row.workout_id).filter(Boolean)));
  let query = supabase
    .from("workouts")
    .delete()
    .gte("date", startDate)
    .lte("date", endDate)
    .eq("completed", false)
    .eq("skipped", false);

  if (loggedIds.length > 0) {
    query = query.not("id", "in", `(${loggedIds.join(",")})`);
  }

  const { error } = await query;
  if (error) throw new Error(`replace existing seed plan failed: ${error.message}`);
}

function buildTrainingPhases(seedStart: string) {
  const shiftDays = daysBetween(DEFAULT_SEED_START_DATE, seedStart);

  return generatedPhaseTemplates.map((phase, index) => ({
    id: fixedPhaseId(index + 1),
    ...phase,
    start_date: addDays(phase.start_date, shiftDays),
    end_date: addDays(phase.end_date, shiftDays),
  }));
}

async function main() {
  // The uploaded research plan is anchored to Monday 2026-05-25. Keep that as the default
  // so Dashboard/Week/Calendar show the exact generated plan unless explicitly overridden.
  const seedStart = process.env.SEED_START_DATE || DEFAULT_SEED_START_DATE;
  console.log(`Seeding generated plan from ${seedStart} (${APP_TIMEZONE})`);
  console.log(`Checking Supabase connectivity for ${supabaseUrl} ...`);
  await withRetry("Supabase connectivity check", verifySupabaseConnection);
  console.log("Supabase connectivity OK");

  await upsertOrThrow("profile", {
    id: PROFILE_ID,
    name: "姚俊豪",
    sex: "男",
    age: 23,
    height_cm: 165,
    current_weight_kg: 67.5,
    target_weight_min_kg: 62,
    target_weight_max_kg: 64,
    current_pb_text: "1:42:36",
    current_pb_seconds: 6156,
    goal_time_text: "1:21:30",
    goal_time_seconds: 4890,
    goal_pace_text: "3'52\"/km",
    goal_pace_seconds_per_km: 232,
    target_race_name: null,
    target_race_date: null,
    location: "广州",
    max_training_days: 6,
  });

  await upsertOrThrow("app_settings", {
    id: APP_SETTINGS_ID,
    access_code_enabled: true,
    dark_mode: false,
    pwa_enabled: true,
    notification_enabled: false,
    ai_model: process.env.AI_MODEL || null,
  });

  await upsertOrThrow("training_phases", buildTrainingPhases(seedStart));
  await optionallyReplaceUnloggedSeedWindow(seedStart);

  const workouts = generatedWorkoutTemplates.map((workout) => ({
    date: addDays(seedStart, workout.dayOffset),
    week_number: workout.week,
    workout_type: workout.workout_type,
    title: workout.title,
    planned_distance_km: workout.planned_distance_km,
    planned_duration_min: workout.planned_duration_min,
    planned_pace_text: workout.planned_pace_text,
    planned_pace_seconds_per_km: workout.planned_pace_seconds_per_km,
    planned_rpe: workout.planned_rpe,
    purpose: workout.purpose,
    warmup: workout.warmup,
    main_set: workout.main_set,
    cooldown: workout.cooldown,
    strength_training: workout.strength_training,
    notes: workout.notes,
    completed: false,
    skipped: false,
  }));

  await upsertOrThrow("workouts", workouts, "date,workout_type,title");

  await upsertOrThrow("plan_versions", {
    id: SEED_VERSION_ID,
    version_name: "专项训练总方案 Seed",
    change_reason: "根据上传的年底冲击半程马拉松 1:21:30 专项训练总方案初始化年度阶段与前 12 周逐日训练。",
    change_type: "system",
    target_table: "full_plan",
    before_data: {},
    after_data: {
      seed_start_date: seedStart,
      profile_id: PROFILE_ID,
      source: generatedPlanSourceSummary,
      phase_count: generatedPhaseTemplates.length,
      workout_count: workouts.length,
    },
    created_by: "system",
  });

  console.log("Seed completed:");
  console.log("- profile: 姚俊豪");
  console.log(`- training phases: ${generatedPhaseTemplates.length}`);
  console.log(`- workouts: ${workouts.length} generated workouts over 12 weeks`);
  console.log("- source: deep-research-report.md");
}

main().catch((error) => {
  console.error("Seed failed.");
  console.error(formatError(error));
  console.error(
    "If this says fetch failed, double-check SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY, local network access to Supabase, and whether your firewall or proxy is blocking https://*.supabase.co."
  );
  process.exit(1);
});
