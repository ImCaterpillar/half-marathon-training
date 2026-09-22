import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { addDays, getTodayDateInTimezone } from "@/lib/time";
import { fetchWorkoutsWithLogs } from "@/lib/services/training-data";

export const GET = withApiAuth(async () => {
  const today = getTodayDateInTimezone();
  const start = addDays(today, -3);
  const end = addDays(today, 3);
  const workouts = await fetchWorkoutsWithLogs(start, end);
  return ok({ start, end, workouts }, "最近 7 天训练计划已读取");
});
