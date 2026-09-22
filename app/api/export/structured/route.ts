import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/auth/api-auth";
import type { DbTable } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { buildStructuredWorkoutExport } from "@/lib/services/structured-export";
import { addDays, getTodayDateInTimezone } from "@/lib/time";

type WorkoutRow = DbTable<"workouts">;

export const GET = withApiAuth(async (request: NextRequest) => {
  const today = request.nextUrl.searchParams.get("start") ?? getTodayDateInTimezone();
  const end = request.nextUrl.searchParams.get("end") ?? addDays(today, 14);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.from("workouts").select("*").gte("date", today).lte("date", end).order("date", { ascending: true });
  if (error) throw new Error(`Failed to export structured workouts: ${error.message}`);

  const payload = buildStructuredWorkoutExport((data ?? []) as WorkoutRow[], { start: today, end });

  return NextResponse.json(payload, {
    status: 200,
    headers: {
      "content-disposition": 'attachment; filename="structured-workouts.json"',
    },
  });
});
