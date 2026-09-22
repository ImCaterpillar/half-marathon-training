import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { fetchDashboardData } from "@/lib/services/training-data";

export const GET = withApiAuth(async (_request: NextRequest) => {
  const data = await fetchDashboardData();
  return ok(data);
});
