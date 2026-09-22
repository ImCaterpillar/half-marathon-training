import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getRequiredEnv } from "@/lib/env";
import type { Database } from "@/lib/db/database";

let cached: SupabaseClient<Database> | null = null;

export function getSupabaseAdmin() {
  if (cached) return cached;

  const supabaseUrl = getRequiredEnv("SUPABASE_URL");
  const serviceRoleKey = getRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  cached = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        "X-Client-Info": "half-marathon-training-manager/server",
      },
    },
  });

  return cached;
}
