import { NextRequest } from "next/server";
import { ok } from "@/lib/api/response";
import { assertApiAccess } from "@/lib/auth/api-auth";

export async function GET(request: NextRequest) {
  return ok({ authenticated: assertApiAccess(request) });
}
