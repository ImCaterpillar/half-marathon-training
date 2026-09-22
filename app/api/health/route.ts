import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { getAppTimezone } from "@/lib/env";
import { formatServerTime } from "@/lib/time";

export const GET = withApiAuth(async (_request: NextRequest) => {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.from("profile").select("id").limit(1);
  if (error) throw new Error(`Database health check failed: ${error.message}`);

  const aiReady = Boolean(process.env.AI_API_KEY && process.env.AI_MODEL);

  return ok({
    database: "ok",
    ai: aiReady ? "ok" : "unavailable",
    time: formatServerTime(getAppTimezone()),
    timezone: getAppTimezone(),
  });
});
