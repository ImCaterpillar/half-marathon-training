import "server-only";
import type { DbInsert, Json } from "@/lib/db/database";
import { getSupabaseAdmin } from "@/lib/db/supabase";

const SECRET_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "AI_API_KEY",
  "APP_ACCESS_CODE_HASH",
  "accessCode",
  "authorization",
  "cookie",
];

function sanitize(value: unknown): unknown {
  if (typeof value === "string") {
    let output = value;
    for (const key of SECRET_KEYS) output = output.replaceAll(key, "[redacted-key]");
    return output.slice(0, 4000);
  }
  if (Array.isArray(value)) return value.map(sanitize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, val]) => [
        SECRET_KEYS.some((secretKey) => key.toLowerCase().includes(secretKey.toLowerCase())) ? "[redacted]" : key,
        SECRET_KEYS.some((secretKey) => key.toLowerCase().includes(secretKey.toLowerCase())) ? "[redacted]" : sanitize(val),
      ])
    );
  }
  return value;
}

export async function logServerError(params: {
  errorType: string;
  message: string;
  stack?: string;
  route?: string;
  payload?: unknown;
}) {
  try {
    const supabase = getSupabaseAdmin();
    const entry: DbInsert<"error_logs"> = {
      error_type: params.errorType,
      message: String(sanitize(params.message)),
      stack: params.stack ? String(sanitize(params.stack)) : null,
      route: params.route ?? null,
      payload: (params.payload ? sanitize(params.payload) : null) as Json | null,
    };
    await supabase.from("error_logs").insert(entry);
  } catch {
    // Logging must never break core API flows.
  }
}
