import { NextRequest, NextResponse } from "next/server";
import { fail } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { toCsv, workoutCsvHeaders } from "@/lib/services/csv";

const exportConfig = {
  workouts: {
    table: "workouts",
    order: "date",
    headers: workoutCsvHeaders,
    filename: "training-plan.csv",
  },
  logs: {
    table: "workout_logs",
    order: "date",
    headers: ["date", "workout_id", "completed", "actual_distance_km", "actual_duration_seconds", "actual_pace_text", "actual_pace_seconds_per_km", "rpe", "sleep_hours", "body_weight_kg", "fatigue_level", "pain_area", "pain_score", "weather", "notes"],
    filename: "workout-logs.csv",
  },
  tests: {
    table: "test_results",
    order: "test_date",
    headers: ["test_date", "test_type", "distance_km", "result_time_text", "result_time_seconds", "avg_pace_text", "avg_pace_seconds_per_km", "weather", "route", "feeling", "predicted_half_marathon_seconds", "predicted_half_marathon_text", "ai_analysis", "notes"],
    filename: "test-results.csv",
  },
  body: {
    table: "body_metrics",
    order: "date",
    headers: ["date", "weight_kg", "sleep_hours", "fatigue_level", "pain_area", "pain_score", "resting_hr", "recovery_score", "ai_recovery_advice", "notes"],
    filename: "body-metrics.csv",
  },
} as const;

export const GET = withApiAuth(async (request: NextRequest) => {
  const type = request.nextUrl.searchParams.get("type") ?? "workouts";
  if (!(type in exportConfig)) return fail("INVALID_EXPORT_TYPE", "导出类型仅支持 workouts、logs、tests、body。", 400);
  const config = exportConfig[type as keyof typeof exportConfig];
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from(config.table).select("*").order(config.order, { ascending: true });
  if (error) throw new Error(`导出 CSV 失败: ${error.message}`);
  const csv = toCsv(config.headers, (data ?? []) as Record<string, unknown>[]);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${config.filename}"`,
    },
  });
});
