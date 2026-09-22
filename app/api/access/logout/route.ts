import { NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, getCookieSecurityOptions } from "@/lib/auth/access-code";

export async function POST() {
  const response = NextResponse.json({ success: true, data: {}, message: "已退出访问状态" });
  response.cookies.set(ACCESS_COOKIE_NAME, "", { ...getCookieSecurityOptions(), maxAge: 0 });
  return response;
}
