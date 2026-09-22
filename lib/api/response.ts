import { NextResponse } from "next/server";

export type ApiErrorPayload = {
  code: string;
  message: string;
  details?: unknown;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message: string;
};

export type ApiFailure = {
  success: false;
  error: ApiErrorPayload;
};

export function ok<T>(data: T, message = "操作成功", status = 200) {
  return NextResponse.json<ApiSuccess<T>>({ success: true, data, message }, { status });
}

export function fail(code: string, message: string, status = 400, details?: unknown) {
  return NextResponse.json<ApiFailure>({ success: false, error: { code, message, details } }, { status });
}
