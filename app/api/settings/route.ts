import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { withApiAuth } from "@/lib/auth/api-auth";
import { getSupabaseAdmin } from "@/lib/db/supabase";
import { normalizeTrainingPreferences } from "@/lib/preferences";
import { fetchAppSettings, fetchProfile, normalizeAppSettings } from "@/lib/services/training-data";
import { settingsUpdateSchema } from "@/lib/validation/settings";

async function fetchSettings() {
  const [profile, app_settings] = await Promise.all([fetchProfile(), fetchAppSettings()]);
  return { profile, app_settings };
}

export const GET = withApiAuth(async () => ok(await fetchSettings()));

export const PUT = withApiAuth(async (request: NextRequest) => {
  const input = settingsUpdateSchema.parse(await request.json());
  const supabase = getSupabaseAdmin() as any;
  const before = await fetchSettings();

  if (!before.profile) {
    return fail("NOT_FOUND", "个人资料不存在，请先执行 seed。", 404);
  }

  let profile = before.profile;
  let appSettings = before.app_settings;

  if (input.profile && Object.keys(input.profile).length > 0) {
    const { data, error } = await supabase
      .from("profile")
      .update(input.profile)
      .eq("id", before.profile.id)
      .select("*")
      .single();

    if (error) throw new Error(`更新个人资料失败: ${error.message}`);
    profile = data;
  }

  if (input.app_settings && Object.keys(input.app_settings).length > 0) {
    if (!before.app_settings?.id) {
      return fail("NOT_FOUND", "应用设置不存在，请先执行 seed。", 404);
    }

    const nextSettings = {
      ...input.app_settings,
      training_preferences: input.app_settings.training_preferences
        ? normalizeTrainingPreferences(input.app_settings.training_preferences)
        : undefined,
    };

    const { data, error } = await supabase
      .from("app_settings")
      .update(nextSettings)
      .eq("id", before.app_settings.id)
      .select("*")
      .single();

    if (error) throw new Error(`更新应用设置失败: ${error.message}`);
    appSettings = normalizeAppSettings(data);
  }

  await supabase.from("audit_logs").insert({
    action_type: "update_settings",
    target_table: "app_settings",
    target_id: appSettings?.id ?? null,
    before_data: before,
    after_data: { profile, app_settings: appSettings },
    source: "manual",
    notes: "设置页保存配置",
  });

  return ok({ profile, app_settings: appSettings }, "设置已保存");
});
