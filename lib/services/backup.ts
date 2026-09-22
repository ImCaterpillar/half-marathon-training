import "server-only";
import { getSupabaseAdmin } from "@/lib/db/supabase";

export const backupTables = [
  "profile",
  "training_phases",
  "workouts",
  "workout_logs",
  "test_results",
  "body_metrics",
  "plan_versions",
  "ai_suggestions",
  "reminders",
  "app_settings",
] as const;

export type BackupTable = typeof backupTables[number];

export async function exportFullBackup() {
  const supabase = getSupabaseAdmin();
  const result: Record<BackupTable | "exported_at" | "version", unknown> = {
    version: "checkpoint-4-json-backup-v1",
    exported_at: new Date().toISOString(),
    profile: [],
    training_phases: [],
    workouts: [],
    workout_logs: [],
    test_results: [],
    body_metrics: [],
    plan_versions: [],
    ai_suggestions: [],
    reminders: [],
    app_settings: [],
  };

  for (const table of backupTables) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) throw new Error(`导出 ${table} 失败: ${error.message}`);
    result[table] = data ?? [];
  }

  return result;
}

export function previewBackupPayload(payload: unknown) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: ["JSON 备份必须是对象"], counts: {} as Record<string, number> };
  }
  const object = payload as Record<string, unknown>;
  const errors: string[] = [];
  const counts: Record<string, number> = {};
  for (const table of backupTables) {
    const value = object[table];
    if (!Array.isArray(value)) {
      errors.push(`${table} 必须是数组`);
      counts[table] = 0;
    } else {
      counts[table] = value.length;
    }
  }
  return { valid: errors.length === 0, errors, counts };
}
