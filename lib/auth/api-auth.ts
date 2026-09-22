import "server-only";
import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { ACCESS_COOKIE_NAME, validateAccessToken } from "@/lib/auth/access-code";
import { fail } from "@/lib/api/response";
import { logServerError } from "@/lib/db/error-log";

type Handler = (request: NextRequest, context?: unknown) => Promise<Response> | Response;

export function assertApiAccess(request: NextRequest) {
  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  return validateAccessToken(token);
}

export function withApiAuth(handler: Handler): Handler {
  return async (request, context) => {
    if (!assertApiAccess(request)) {
      return fail("UNAUTHORIZED", "访问凭证无效或已过期，请重新输入访问码。", 401);
    }

    try {
      return await handler(request, context);
    } catch (error) {
      if (error instanceof ZodError) {
        return fail("VALIDATION_ERROR", "参数校验失败。", 422, error.flatten());
      }
      const message = error instanceof Error ? error.message : "Unknown server error";
      const stack = error instanceof Error ? error.stack : undefined;
      await logServerError({
        errorType: "API_ERROR",
        message,
        stack,
        route: request.nextUrl.pathname,
      });
      return fail("INTERNAL_SERVER_ERROR", "服务器处理失败，请稍后重试。", 500);
    }
  };
}
