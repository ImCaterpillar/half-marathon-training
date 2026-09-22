import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { fetchRecentPlanTimeline } from "@/lib/services/plan-explanations";

export const GET = withApiAuth(async (_request: NextRequest) => {
  const versions = await fetchRecentPlanTimeline(100);
  return ok({ versions });
});
