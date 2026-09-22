"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { Download, LogOut, Save, Smartphone } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { clearOfflineData } from "@/lib/browser/offline-store";
import { defaultTrainingPreferences, trainingDayOptions } from "@/lib/preferences";
import type { SettingsData, TrainingDay, TrainingPreferences } from "@/lib/types/training";

type SettingsForm = {
  name: string;
  age: string;
  height_cm: string;
  current_weight_kg: string;
  target_weight_min_kg: string;
  target_weight_max_kg: string;
  target_race_name: string;
  target_race_date: string;
  max_training_days: string;
  access_code_enabled: boolean;
  dark_mode: boolean;
  pwa_enabled: boolean;
  notification_enabled: boolean;
  ai_model: string;
  training_preferences: {
    training_days_per_week: string;
    preferred_long_run_day: TrainingDay;
    allowed_hard_workout_days: TrainingDay[];
    strength_training_enabled: boolean;
    strength_context: TrainingPreferences["strength_context"];
    weekly_time_capacity_minutes: string;
    weekly_mileage_tolerance_km: string;
    temporary_constraint: TrainingPreferences["temporary_constraint"];
  };
};

const dayLabel: Record<TrainingDay, string> = {
  monday: "周一",
  tuesday: "周二",
  wednesday: "周三",
  thursday: "周四",
  friday: "周五",
  saturday: "周六",
  sunday: "周日",
};

const constraintLabel: Record<TrainingPreferences["temporary_constraint"], string> = {
  none: "无临时限制",
  travel_week: "出差周",
  reduced_load_week: "减量周",
};

const emptyForm: SettingsForm = {
  name: "",
  age: "",
  height_cm: "",
  current_weight_kg: "",
  target_weight_min_kg: "",
  target_weight_max_kg: "",
  target_race_name: "",
  target_race_date: "",
  max_training_days: "6",
  access_code_enabled: true,
  dark_mode: false,
  pwa_enabled: true,
  notification_enabled: false,
  ai_model: "",
  training_preferences: {
    training_days_per_week: String(defaultTrainingPreferences.training_days_per_week),
    preferred_long_run_day: defaultTrainingPreferences.preferred_long_run_day,
    allowed_hard_workout_days: defaultTrainingPreferences.allowed_hard_workout_days,
    strength_training_enabled: defaultTrainingPreferences.strength_training_enabled,
    strength_context: defaultTrainingPreferences.strength_context,
    weekly_time_capacity_minutes: "",
    weekly_mileage_tolerance_km: "",
    temporary_constraint: defaultTrainingPreferences.temporary_constraint,
  },
};

function toOptionalNumber(value: string) {
  return value.trim() === "" ? undefined : Number(value);
}

function toNullableNumber(value: string) {
  return value.trim() === "" ? null : Number(value);
}

function buildForm(data: SettingsData): SettingsForm {
  const preferences = data.app_settings?.training_preferences ?? defaultTrainingPreferences;

  return {
    name: data.profile?.name ?? "",
    age: data.profile?.age?.toString() ?? "",
    height_cm: data.profile?.height_cm?.toString() ?? "",
    current_weight_kg: data.profile?.current_weight_kg?.toString() ?? "",
    target_weight_min_kg: data.profile?.target_weight_min_kg?.toString() ?? "",
    target_weight_max_kg: data.profile?.target_weight_max_kg?.toString() ?? "",
    target_race_name: data.profile?.target_race_name ?? "",
    target_race_date: data.profile?.target_race_date ?? "",
    max_training_days: data.profile?.max_training_days?.toString() ?? "6",
    access_code_enabled: data.app_settings?.access_code_enabled ?? true,
    dark_mode: data.app_settings?.dark_mode ?? false,
    pwa_enabled: data.app_settings?.pwa_enabled ?? true,
    notification_enabled: data.app_settings?.notification_enabled ?? false,
    ai_model: data.app_settings?.ai_model ?? "",
    training_preferences: {
      training_days_per_week: preferences.training_days_per_week.toString(),
      preferred_long_run_day: preferences.preferred_long_run_day,
      allowed_hard_workout_days: preferences.allowed_hard_workout_days,
      strength_training_enabled: preferences.strength_training_enabled,
      strength_context: preferences.strength_context,
      weekly_time_capacity_minutes: preferences.weekly_time_capacity_minutes?.toString() ?? "",
      weekly_mileage_tolerance_km: preferences.weekly_mileage_tolerance_km?.toString() ?? "",
      temporary_constraint: preferences.temporary_constraint,
    },
  };
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState<SettingsForm>(emptyForm);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/settings", { cache: "no-store" });
      const json = (await response.json()) as { success?: boolean; data?: SettingsData; error?: { message?: string } };
      if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "读取设置失败");
      setData(json.data);
      setForm(buildForm(json.data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", form.dark_mode);
  }, [form.dark_mode]);

  function toggleHardWorkoutDay(day: TrainingDay, checked: boolean) {
    const nextDays = checked
      ? Array.from(new Set([...form.training_preferences.allowed_hard_workout_days, day]))
      : form.training_preferences.allowed_hard_workout_days.filter((value) => value !== day);

    setForm({
      ...form,
      training_preferences: {
        ...form.training_preferences,
        allowed_hard_workout_days: nextDays,
      },
    });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          profile: {
            name: form.name.trim() || undefined,
            age: toOptionalNumber(form.age),
            height_cm: toOptionalNumber(form.height_cm),
            current_weight_kg: toOptionalNumber(form.current_weight_kg),
            target_weight_min_kg: toOptionalNumber(form.target_weight_min_kg),
            target_weight_max_kg: toOptionalNumber(form.target_weight_max_kg),
            target_race_name: form.target_race_name.trim() || "",
            target_race_date: form.target_race_date || "",
            max_training_days: toOptionalNumber(form.max_training_days),
          },
          app_settings: {
            access_code_enabled: form.access_code_enabled,
            dark_mode: form.dark_mode,
            pwa_enabled: form.pwa_enabled,
            notification_enabled: form.notification_enabled,
            ai_model: form.ai_model.trim() || "",
            training_preferences: {
              training_days_per_week: Number(form.training_preferences.training_days_per_week),
              preferred_long_run_day: form.training_preferences.preferred_long_run_day,
              allowed_hard_workout_days: form.training_preferences.allowed_hard_workout_days,
              strength_training_enabled: form.training_preferences.strength_training_enabled,
              strength_context: form.training_preferences.strength_context,
              weekly_time_capacity_minutes: toNullableNumber(form.training_preferences.weekly_time_capacity_minutes),
              weekly_mileage_tolerance_km: toNullableNumber(form.training_preferences.weekly_mileage_tolerance_km),
              temporary_constraint: form.training_preferences.temporary_constraint,
            },
          },
        }),
      });

      const json = (await response.json()) as {
        success?: boolean;
        data?: SettingsData;
        message?: string;
        error?: { message?: string };
      };

      if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "保存失败");
      setData(json.data);
      setForm(buildForm(json.data));
      setMessage(json.message ?? "设置已保存");
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    await fetch("/api/access/logout", { method: "POST" });
    location.reload();
  }

  async function requestNotification() {
    if (!("Notification" in window)) {
      setError("当前浏览器不支持通知。");
      return;
    }

    const result = await Notification.requestPermission();
    setMessage(result === "granted" ? "通知权限已开启。" : "通知权限未开启。");
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">我的配置</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">设置</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              训练偏好会直接影响 AI 建议、训练生成和每日首页提示。
            </p>
          </div>
          <Button variant="outline" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            退出访问
          </Button>
        </header>

        {loading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">正在读取设置...</CardContent></Card> : null}
        {message ? <Card><CardContent className="p-4 text-sm text-emerald-600">{message}</CardContent></Card> : null}
        {error ? <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card> : null}

        {!loading && data ? (
          <form className="space-y-6" onSubmit={save}>
            <Card>
              <CardHeader>
                <CardTitle>基础资料</CardTitle>
                <CardDescription>这些信息会用于阶段目标、配速估计和恢复评估。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm">姓名<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
                <label className="text-sm">年龄<Input type="number" value={form.age} onChange={(event) => setForm({ ...form, age: event.target.value })} /></label>
                <label className="text-sm">身高 cm<Input type="number" value={form.height_cm} onChange={(event) => setForm({ ...form, height_cm: event.target.value })} /></label>
                <label className="text-sm">当前体重 kg<Input type="number" step="0.1" value={form.current_weight_kg} onChange={(event) => setForm({ ...form, current_weight_kg: event.target.value })} /></label>
                <label className="text-sm">目标体重下限 kg<Input type="number" step="0.1" value={form.target_weight_min_kg} onChange={(event) => setForm({ ...form, target_weight_min_kg: event.target.value })} /></label>
                <label className="text-sm">目标体重上限 kg<Input type="number" step="0.1" value={form.target_weight_max_kg} onChange={(event) => setForm({ ...form, target_weight_max_kg: event.target.value })} /></label>
                <label className="text-sm">目标赛事名称<Input value={form.target_race_name} onChange={(event) => setForm({ ...form, target_race_name: event.target.value })} placeholder="例如 上海半马" /></label>
                <label className="text-sm">目标赛事日期<Input type="date" value={form.target_race_date} onChange={(event) => setForm({ ...form, target_race_date: event.target.value })} /></label>
                <label className="text-sm">每周最多训练天数<Input type="number" min="1" max="7" value={form.max_training_days} onChange={(event) => setForm({ ...form, max_training_days: event.target.value })} /></label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>训练偏好</CardTitle>
                <CardDescription>把你的真实日程、训练容量和限制告诉系统，计划才会更像教练而不是模板。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  <label className="text-sm">
                    每周训练天数
                    <Input
                      type="number"
                      min="1"
                      max="7"
                      value={form.training_preferences.training_days_per_week}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          training_preferences: {
                            ...form.training_preferences,
                            training_days_per_week: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    长距离安排日
                    <select
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.training_preferences.preferred_long_run_day}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          training_preferences: {
                            ...form.training_preferences,
                            preferred_long_run_day: event.target.value as TrainingDay,
                          },
                        })
                      }
                    >
                      {trainingDayOptions.map((day) => <option key={day} value={day}>{dayLabel[day]}</option>)}
                    </select>
                  </label>
                  <label className="text-sm">
                    力量训练方式
                    <select
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.training_preferences.strength_context}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          training_preferences: {
                            ...form.training_preferences,
                            strength_context: event.target.value as TrainingPreferences["strength_context"],
                          },
                        })
                      }
                    >
                      <option value="bodyweight">徒手优先</option>
                      <option value="equipment">可用器械</option>
                    </select>
                  </label>
                  <label className="text-sm">
                    每周可投入分钟数
                    <Input
                      type="number"
                      min="30"
                      value={form.training_preferences.weekly_time_capacity_minutes}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          training_preferences: {
                            ...form.training_preferences,
                            weekly_time_capacity_minutes: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    每周里程容忍上限 km
                    <Input
                      type="number"
                      min="1"
                      step="0.1"
                      value={form.training_preferences.weekly_mileage_tolerance_km}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          training_preferences: {
                            ...form.training_preferences,
                            weekly_mileage_tolerance_km: event.target.value,
                          },
                        })
                      }
                    />
                  </label>
                  <label className="text-sm">
                    临时限制
                    <select
                      className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm"
                      value={form.training_preferences.temporary_constraint}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          training_preferences: {
                            ...form.training_preferences,
                            temporary_constraint: event.target.value as TrainingPreferences["temporary_constraint"],
                          },
                        })
                      }
                    >
                      {Object.entries(constraintLabel).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  </label>
                </div>

                <label className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={form.training_preferences.strength_training_enabled}
                    onChange={(event) =>
                      setForm({
                        ...form,
                        training_preferences: {
                          ...form.training_preferences,
                          strength_training_enabled: event.target.checked,
                        },
                      })
                    }
                  />
                  保留力量训练
                </label>

                <div className="space-y-2">
                  <p className="text-sm font-medium">允许安排高质量课的日子</p>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {trainingDayOptions.map((day) => (
                      <label key={day} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                        <input
                          type="checkbox"
                          checked={form.training_preferences.allowed_hard_workout_days.includes(day)}
                          onChange={(event) => toggleHardWorkoutDay(day, event.target.checked)}
                        />
                        {dayLabel[day]}
                      </label>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">至少保留一天，AI 调整和后续计划生成会优先遵守这里的限制。</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>应用设置</CardTitle>
                <CardDescription>这里控制访问、PWA 和通知行为，不存放敏感密钥。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-2">
                {[
                  ["access_code_enabled", "启用访问密码"],
                  ["dark_mode", "启用深色模式"],
                  ["pwa_enabled", "启用 PWA"],
                  ["notification_enabled", "启用通知"],
                ].map(([key, label]) => (
                  <label key={key} className="flex items-center gap-3 rounded-lg border p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={form[key as keyof Pick<SettingsForm, "access_code_enabled" | "dark_mode" | "pwa_enabled" | "notification_enabled">]}
                      onChange={(event) => setForm({ ...form, [key]: event.target.checked })}
                    />
                    {label}
                  </label>
                ))}
                <label className="text-sm sm:col-span-2">
                  AI 模型配置
                  <Input value={form.ai_model} onChange={(event) => setForm({ ...form, ai_model: event.target.value })} placeholder="留空时继续使用环境变量中的默认模型" />
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>数据导出与 PWA</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap gap-2">
                <Button asChild variant="outline"><Link href="/api/export/json"><Download className="mr-2 h-4 w-4" />导出全部 JSON</Link></Button>
                <Button asChild variant="outline"><Link href="/api/export/csv?type=workouts"><Download className="mr-2 h-4 w-4" />导出训练 CSV</Link></Button>
                <Button type="button" variant="outline" onClick={requestNotification}><Smartphone className="mr-2 h-4 w-4" />请求通知权限</Button>
                <Button type="button" variant="outline" onClick={() => clearOfflineData().then(() => setMessage("离线缓存已清空。"))}>清空离线缓存</Button>
              </CardContent>
            </Card>

            <Button type="submit" disabled={saving} size="lg" className="w-full sm:w-auto">
              <Save className="mr-2 h-4 w-4" />
              {saving ? "保存中..." : "保存设置"}
            </Button>
          </form>
        ) : null}
      </div>
    </AppShell>
  );
}
