import "server-only";
import type { NextRequest } from "next/server";
import { fail } from "@/lib/api/response";
import { getClientIp, hitRateLimit } from "@/lib/rate-limit";
import { AIResponseFormatError, AIUnavailableError } from "@/lib/ai/provider";
import { logServerError } from "@/lib/db/error-log";

const AI_LIMIT = { maxRequests: 8, windowMs: 10 * 60 * 1000 };

export function enforceAIRateLimit(request: NextRequest, scope: string) {
  const ip = getClientIp(request);
  const result = hitRateLimit(`ai:${scope}:${ip}`, AI_LIMIT);
  if (result.limited) {
    return fail("RATE_LIMITED", "请求过于频繁，请稍后再试。", 429, { resetAt: new Date(result.resetAt).toISOString() });
  }
  return null;
}

export async function aiFailureResponse(request: NextRequest, error: unknown) {
  if (error instanceof AIResponseFormatError) {
    return fail("AI_RESPONSE_FORMAT_ERROR", error.message, 502);
  }
  if (error instanceof AIUnavailableError) {
    return fail("AI_UNAVAILABLE", error.message, 503);
  }
  await logServerError({
    errorType: "AI_API_ERROR",
    message: error instanceof Error ? error.message : "AI route failed",
    stack: error instanceof Error ? error.stack : undefined,
    route: request.nextUrl.pathname,
  });
  return fail("AI_API_ERROR", "AI 建议暂不可用，请稍后重试。", 503);
}
