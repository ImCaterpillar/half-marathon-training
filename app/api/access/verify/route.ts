import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ACCESS_COOKIE_NAME,
  createAccessToken,
  getCookieSecurityOptions,
  verifyAccessCode,
} from "@/lib/auth/access-code";
import { fail } from "@/lib/api/response";
import { clearFailures, getClientIp, isLocked, recordFailure } from "@/lib/rate-limit";
import { logServerError } from "@/lib/db/error-log";

const schema = z.object({ accessCode: z.string().min(1).max(128) });

const FAILURE_OPTIONS = {
  maxFailures: 5,
  windowMs: 10 * 60 * 1000,
  lockMs: 15 * 60 * 1000,
};

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const key = `access:${ip}`;

  if (isLocked(key)) {
    return fail("RATE_LIMITED", "访问码错误次数过多，请稍后再试。", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("INVALID_JSON", "请求体不是有效 JSON。", 400);
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "访问码格式不正确。", 422, parsed.error.flatten());
  }

  try {
    const valid = verifyAccessCode(parsed.data.accessCode);
    if (!valid) {
      recordFailure(key, FAILURE_OPTIONS);
      return fail("ACCESS_CODE_INVALID", "访问码不正确。", 401);
    }

    clearFailures(key);
    const response = NextResponse.json({
      success: true,
      data: { authenticated: true },
      message: "访问码验证成功",
    });
    response.cookies.set(ACCESS_COOKIE_NAME, createAccessToken(), getCookieSecurityOptions());
    return response;
  } catch (error) {
    await logServerError({
      errorType: "ACCESS_VERIFY_ERROR",
      message: error instanceof Error ? error.message : "Access verify failed",
      stack: error instanceof Error ? error.stack : undefined,
      route: request.nextUrl.pathname,
    });
    return fail("ACCESS_VERIFY_ERROR", "访问码服务配置异常，请检查服务端环境变量。", 500);
  }
}
