"use client";

import Link from "next/link";
import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRightLeft, Gauge, Save, ShieldAlert, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getCachedRecentWorkouts, savePendingWorkoutLog } from "@/lib/browser/offline-store";
import { formatDistanceKm, formatDuration, formatPace } from "@/lib/format";
import type { WorkoutExecutionReview, WorkoutPlanSnapshot, WorkoutWithLog } from "@/lib/types/training";

type PageProps = { params: Promise<{ id: string }> };

type WorkoutResponse = {
  success?: boolean;
  message?: string;
  data?: WorkoutWithLog;
  error?: { message?: string };
};

type MutationResponse = {
  success?: boolean;
  message?: string;
  error?: { message?: string };
};

function useWorkoutId(params: PageProps["params"]) {
  const [id, setId] = useState("");

  useEffect(() => {
    void params.then((value) => setId(value.id));
  }, [params]);

  return id;
}

function statusTone(workout: WorkoutWithLog) {
  if (workout.log?.completed || workout.completed) return "green" as const;
  if (workout.skipped) return "yellow" as const;
  return "secondary" as const;
}

function statusLabel(workout: WorkoutWithLog) {
  if (workout.log?.completed || workout.completed) return "已完成";
  if (workout.skipped) return "已跳过";
  return "计划中";
}

function executionTone(status: WorkoutExecutionReview["status"]) {
  if (status === "on_target") return "green" as const;
  if (status === "completed_hard") return "yellow" as const;
  if (status === "shortened") return "orange" as const;
  if (status === "overreached") return "red" as const;
  return "secondary" as const;
}

function formatSnapshotValue(snapshot: WorkoutPlanSnapshot | null, field: "date" | "distance" | "duration" | "rpe") {
  if (!snapshot) return "--";
  if (field === "date") return snapshot.date ?? "--";
  if (field === "distance") return `${snapshot.planned_distance_km} km`;
  if (field === "duration") return `${snapshot.planned_duration_min} min`;
  return snapshot.planned_rpe === null ? "--" : `RPE ${snapshot.planned_rpe}`;
}

function getChangeVisual(detail: NonNullable<WorkoutWithLog["explanation"]>["change_details"][number]) {
  const beforeDate = detail.before?.date ?? null;
  const afterDate = detail.after?.date ?? null;
  const beforeDistance = detail.before?.planned_distance_km ?? null;
  const afterDistance = detail.after?.planned_distance_km ?? null;
  const beforeDuration = detail.before?.planned_duration_min ?? null;
  const afterDuration = detail.after?.planned_duration_min ?? null;
  const beforeRpe = detail.before?.planned_rpe ?? null;
  const afterRpe = detail.after?.planned_rpe ?? null;
  const moved = beforeDate !== afterDate;
  const resized =
    (beforeDistance !== null && afterDistance !== null && Math.abs(beforeDistance - afterDistance) >= 1) ||
    (beforeDuration !== null && afterDuration !== null && Math.abs(beforeDuration - afterDuration) >= 10) ||
    beforeRpe !== afterRpe;
  const guardrail = detail.triggers.some((trigger) => trigger.includes("safeguard") || trigger.includes("constraint"));

  if (guardrail) {
    return {
      label: "保护性调整",
      tone: "yellow" as const,
      cardClass: "border-yellow-300 bg-yellow-50/70 dark:border-yellow-900 dark:bg-yellow-950/20",
      Icon: ShieldAlert,
    };
  }
  if (resized) {
    return {
      label: "缩放负荷",
      tone: "orange" as const,
      cardClass: "border-orange-300 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/20",
      Icon: Gauge,
    };
  }
  if (moved) {
    return {
      label: "调整日期",
      tone: "secondary" as const,
      cardClass: "border-blue-300 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20",
      Icon: ArrowRightLeft,
    };
  }
  return {
    label: "已调整",
    tone: "outline" as const,
    cardClass: "border-border bg-background",
    Icon: Sparkles,
  };
}

export default function WorkoutDetailPage({ params }: PageProps) {
  const id = useWorkoutId(params);
  const [workout, setWorkout] = useState<WorkoutWithLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    completed: true,
    actual_distance_km: "",
    duration_minutes: "",
    duration_seconds_extra: "0",
    rpe: "3",
    sleep_hours: "",
    body_weight_kg: "",
    fatigue_level: "3",
    pain_area: "",
    pain_score: "0",
    notes: "",
    weather: "",
  });

  async function load(workoutId = id) {
    if (!workoutId) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/workouts/${workoutId}`, { cache: "no-store" });
      const json = (await response.json()) as WorkoutResponse;
      if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "加载训练失败。");

      const loaded = json.data;
      setWorkout(loaded);

      const log = loaded.log;
      setForm({
        completed: log?.completed ?? true,
        actual_distance_km: String(log?.actual_distance_km ?? loaded.planned_distance_km ?? ""),
        duration_minutes: String(log?.actual_duration_seconds ? Math.floor(log.actual_duration_seconds / 60) : loaded.planned_duration_min ?? ""),
        duration_seconds_extra: String(log?.actual_duration_seconds ? log.actual_duration_seconds % 60 : 0),
        rpe: String(log?.rpe ?? loaded.planned_rpe ?? 3),
        sleep_hours: String(log?.sleep_hours ?? ""),
        body_weight_kg: String(log?.body_weight_kg ?? ""),
        fatigue_level: String(log?.fatigue_level ?? 3),
        pain_area: log?.pain_area ?? "",
        pain_score: String(log?.pain_score ?? 0),
        notes: log?.notes ?? "",
        weather: log?.weather ?? "",
      });
    } catch (err) {
      try {
        const cached = await getCachedRecentWorkouts();
        const offlineWorkout = cached.find((item) => item.id === workoutId);
        if (offlineWorkout) {
          setWorkout(offlineWorkout as WorkoutWithLog);
          setError("当前网络不可用，已加载最近一次缓存的训练内容。");
          return;
        }
      } catch {
        // Ignore cache lookup failures.
      }

      setError(err instanceof Error ? err.message : "加载训练失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (id) void load(id);
  }, [id]);

  const computedPace = useMemo(() => {
    const distance = Number(form.actual_distance_km);
    const seconds = Number(form.duration_minutes || 0) * 60 + Number(form.duration_seconds_extra || 0);
    if (!distance || !seconds) return "--";
    return formatPace(Math.round(seconds / distance));
  }, [form.actual_distance_km, form.duration_minutes, form.duration_seconds_extra]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;

    setSubmitting(true);
    setMessage("");
    setError("");

    try {
      const actualDurationSeconds = Number(form.duration_minutes || 0) * 60 + Number(form.duration_seconds_extra || 0);
      const payload = {
        completed: form.completed,
        actual_distance_km: Number(form.actual_distance_km || 0),
        actual_duration_seconds: actualDurationSeconds,
        rpe: form.rpe === "" ? null : Number(form.rpe),
        sleep_hours: form.sleep_hours === "" ? null : Number(form.sleep_hours),
        body_weight_kg: form.body_weight_kg === "" ? null : Number(form.body_weight_kg),
        fatigue_level: form.fatigue_level === "" ? null : Number(form.fatigue_level),
        pain_area: form.pain_area,
        pain_score: form.pain_score === "" ? null : Number(form.pain_score),
        notes: form.notes,
        weather: form.weather,
      };

      const response = await fetch(`/api/workouts/${id}/log`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await response.json()) as MutationResponse;
      if (!response.ok || !json.success) throw new Error(json.error?.message ?? "保存训练记录失败。");

      setMessage(json.message ?? "训练记录已保存。");
      await load(id);
    } catch (err) {
      if (!navigator.onLine || err instanceof TypeError) {
        const actualDurationSeconds = Number(form.duration_minutes || 0) * 60 + Number(form.duration_seconds_extra || 0);
        await savePendingWorkoutLog({
          workoutId: id,
          workoutDate: workout?.date ?? "",
          workoutTitle: workout?.title ?? "训练",
          payload: {
            completed: form.completed,
            actual_distance_km: Number(form.actual_distance_km || 0),
            actual_duration_seconds: actualDurationSeconds,
            rpe: form.rpe === "" ? null : Number(form.rpe),
            sleep_hours: form.sleep_hours === "" ? null : Number(form.sleep_hours),
            body_weight_kg: form.body_weight_kg === "" ? null : Number(form.body_weight_kg),
            fatigue_level: form.fatigue_level === "" ? null : Number(form.fatigue_level),
            pain_area: form.pain_area,
            pain_score: form.pain_score === "" ? null : Number(form.pain_score),
            notes: form.notes,
            weather: form.weather,
          },
        });
        setMessage("已离线保存，设备重新联网后会自动同步。");
      } else {
        setError(err instanceof Error ? err.message : "保存训练记录失败。");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const review = workout?.explanation?.execution_review ?? null;

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost">
            <Link href="/week">
              <ArrowLeft className="mr-2 h-4 w-4" />
              返回周视图
            </Link>
          </Button>
        </div>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">正在加载训练...</CardContent>
          </Card>
        ) : null}

        {error ? (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        {!loading && workout ? (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={statusTone(workout)}>{statusLabel(workout)}</Badge>
                  <Badge tone="outline">{workout.workout_type}</Badge>
                  {workout.strength_training ? <Badge tone="outline">力量训练</Badge> : null}
                  {workout.explanation?.is_preference_adjusted ? (
                    <Badge tone="orange">
                      <Sparkles className="mr-1 h-3 w-3" />
                      按偏好校准
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-2xl sm:text-3xl">{workout.title}</CardTitle>
                <CardDescription>
                  {workout.date} | {formatDistanceKm(workout.planned_distance_km)} | {workout.planned_duration_min} 分钟 | 计划 RPE{" "}
                  {workout.planned_rpe ?? "--"}
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div className="space-y-3 text-sm leading-6">
                  <p>
                    <span className="font-medium">计划配速：</span>
                    {workout.planned_pace_text ?? formatPace(workout.planned_pace_seconds_per_km)}
                  </p>
                  <p>
                    <span className="font-medium">训练目的：</span>
                    {workout.purpose ?? "未记录训练目的。"}
                  </p>
                  <p>
                    <span className="font-medium">热身：</span>
                    {workout.warmup ?? "未记录热身说明。"}
                  </p>
                  <p>
                    <span className="font-medium">主训练：</span>
                    {workout.main_set ?? "未记录主训练说明。"}
                  </p>
                </div>
                <div className="space-y-3 text-sm leading-6">
                  <p>
                    <span className="font-medium">放松：</span>
                    {workout.cooldown ?? "未记录放松说明。"}
                  </p>
                  <p>
                    <span className="font-medium">计划备注：</span>
                    {workout.notes ?? "未记录额外计划备注。"}
                  </p>
                  {workout.log ? (
                    <div className="rounded-2xl bg-emerald-50 p-3 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      完成记录：{formatDistanceKm(workout.log.actual_distance_km)} | {formatDuration(workout.log.actual_duration_seconds)} |{" "}
                      {workout.log.actual_pace_text ?? "未记录配速"}
                    </div>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {review ? (
              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center gap-2">
                    <CardTitle>完成质量回顾</CardTitle>
                    <Badge tone={executionTone(review.status)}>{review.status.replace("_", " ")}</Badge>
                  </div>
                  <CardDescription>把计划负荷和实际执行放在一起看，方便判断下一步该怎么调。</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border bg-muted/30 p-4">
                    <p className="text-base font-semibold">{review.headline}</p>
                    <p className="mt-1 text-sm font-medium text-muted-foreground">{review.pattern_label}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{review.summary}</p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">距离变化</p>
                      <p className="mt-2 text-lg font-semibold">
                        {review.distance_delta_km === null ? "--" : `${review.distance_delta_km > 0 ? "+" : ""}${review.distance_delta_km} km`}
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">时长变化</p>
                      <p className="mt-2 text-lg font-semibold">
                        {review.duration_delta_min === null ? "--" : `${review.duration_delta_min > 0 ? "+" : ""}${review.duration_delta_min} min`}
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">配速变化</p>
                      <p className="mt-2 text-lg font-semibold">
                        {review.pace_delta_seconds_per_km === null
                          ? "--"
                          : `${review.pace_delta_seconds_per_km > 0 ? "+" : ""}${review.pace_delta_seconds_per_km}s/km`}
                      </p>
                    </div>
                    <div className="rounded-2xl border p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">强度变化</p>
                      <p className="mt-2 text-lg font-semibold">
                        {review.effort_delta === null ? "--" : `${review.effort_delta > 0 ? "+" : ""}${review.effort_delta} RPE`}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-200">
                    {review.recommendation}
                  </div>
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>这堂课为什么会这样安排</CardTitle>
                <CardDescription>
                  This view combines preference constraints, AI suggestions, and recent plan edits so you can trace how today&apos;s session was shaped.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {workout.explanation?.constraint_reasons && workout.explanation.constraint_reasons.length > 0 ? (
                  <div>
                    <p className="mb-2 font-medium">偏好约束调整</p>
                    <div className="space-y-2 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-orange-700 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-300">
                      {workout.explanation.constraint_reasons.map((reason) => (
                        <p key={reason}>{reason}</p>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No preference-based adjustments were detected for this workout.</p>
                )}

                {workout.explanation?.source_suggestion ? (
                  <div className="rounded-2xl border bg-muted/30 p-3">
                    <p className="font-medium">AI 来源</p>
                    <p className="mt-1">
                      {workout.explanation.source_suggestion.suggestion_type} | {workout.explanation.source_suggestion.suggestion_text}
                    </p>
                    <p className="mt-1 text-muted-foreground">
                      {new Date(workout.explanation.source_suggestion.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                    </p>
                  </div>
                ) : null}

                {workout.explanation?.change_details && workout.explanation.change_details.length > 0 ? (
                  <div>
                    <p className="mb-2 font-medium">这堂课具体改了什么</p>
                    <div className="space-y-3">
                      {workout.explanation.change_details.map((detail) => {
                        const visual = getChangeVisual(detail);
                        const Icon = visual.Icon;
                        return (
                        <div key={detail.version_id} className={`rounded-2xl border p-4 ${visual.cardClass}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={visual.tone}>
                              <Icon className="mr-1 h-3 w-3" />
                              {visual.label}
                            </Badge>
                            <Badge tone={detail.change_type === "ai" ? "green" : detail.change_type === "restore" ? "orange" : "secondary"}>
                              {detail.change_type}
                            </Badge>
                            <span className="font-medium">{detail.version_name}</span>
                          </div>

                          <div className="mt-3 grid gap-3 md:grid-cols-4">
                            <div className="rounded-2xl bg-muted/40 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Date</p>
                              <p className="mt-2 text-sm font-medium">
                                {formatSnapshotValue(detail.before, "date")} {"->"} {formatSnapshotValue(detail.after, "date")}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-muted/40 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Distance</p>
                              <p className="mt-2 text-sm font-medium">
                                {formatSnapshotValue(detail.before, "distance")} {"->"} {formatSnapshotValue(detail.after, "distance")}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-muted/40 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">时长</p>
                              <p className="mt-2 text-sm font-medium">
                                {formatSnapshotValue(detail.before, "duration")} {"->"} {formatSnapshotValue(detail.after, "duration")}
                              </p>
                            </div>
                            <div className="rounded-2xl bg-muted/40 p-3">
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">Effort</p>
                              <p className="mt-2 text-sm font-medium">
                                {formatSnapshotValue(detail.before, "rpe")} {"->"} {formatSnapshotValue(detail.after, "rpe")}
                              </p>
                            </div>
                          </div>

                          {detail.changes.length > 0 ? (
                            <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                              {detail.changes.map((change) => (
                                <p key={change}>{change}</p>
                              ))}
                            </div>
                          ) : null}

                          {detail.triggers.length > 0 ? (
                            <div className="mt-3 flex flex-wrap gap-2">
                              {detail.triggers.map((trigger) => (
                                <Badge key={trigger} tone="outline">
                                  {trigger}
                                </Badge>
                              ))}
                            </div>
                          ) : null}

                          <p className="mt-3 text-xs text-muted-foreground">
                            {new Date(detail.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                          </p>
                        </div>
                      )})}
                    </div>
                  </div>
                ) : null}

                {workout.explanation?.latest_audit_note ? (
                  <div className="rounded-2xl border bg-muted/30 p-3">
                    <p className="font-medium">最近一次人工 / 系统备注</p>
                    <p className="mt-1">{workout.explanation.latest_audit_note}</p>
                  </div>
                ) : null}

                {workout.explanation?.recent_versions && workout.explanation.recent_versions.length > 0 ? (
                  <div>
                    <p className="mb-2 font-medium">最近版本记录</p>
                    <div className="space-y-2">
                      {workout.explanation.recent_versions.map((version) => (
                        <div key={version.id} className="rounded-2xl border p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone={version.change_type === "ai" ? "green" : version.change_type === "restore" ? "orange" : "secondary"}>
                              {version.change_type}
                            </Badge>
                            <span className="font-medium">{version.version_name}</span>
                          </div>
                          <p className="mt-2 text-muted-foreground">{version.impact_summary ?? version.change_reason ?? "Plan snapshot updated."}</p>
                          {version.change_tags && version.change_tags.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {version.change_tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} tone="outline">
                                  {tag.replaceAll("_", " ")}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                          {version.highlights && version.highlights.length > 0 ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {version.highlights.slice(0, 2).map((item) => (
                                <Badge key={item} tone="outline">
                                  {item}
                                </Badge>
                              ))}
                            </div>
                          ) : null}
                          <p className="mt-2 text-xs text-muted-foreground">
                            {new Date(version.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>训练记录</CardTitle>
                <CardDescription>记录这次训练实际发生了什么，恢复分析、统计结果和后续计划调整才会更准确。</CardDescription>
              </CardHeader>
              <CardContent>
                {message ? <p className="mb-4 text-sm text-emerald-600">{message}</p> : null}
                <form className="space-y-5" onSubmit={handleSubmit}>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <label className="flex items-center gap-2 rounded-2xl border p-3 text-sm sm:col-span-2 lg:col-span-4">
                      <input type="checkbox" checked={form.completed} onChange={(event) => setForm({ ...form, completed: event.target.checked })} />
                      Mark this workout as completed
                    </label>
                    <label className="text-sm">
                      距离（km）
                      <Input type="number" min="0" step="0.01" value={form.actual_distance_km} onChange={(event) => setForm({ ...form, actual_distance_km: event.target.value })} required />
                    </label>
                    <label className="text-sm">
                      时长（分钟）
                      <Input type="number" min="0" value={form.duration_minutes} onChange={(event) => setForm({ ...form, duration_minutes: event.target.value })} required />
                    </label>
                    <label className="text-sm">
                      Extra seconds
                      <Input type="number" min="0" max="59" value={form.duration_seconds_extra} onChange={(event) => setForm({ ...form, duration_seconds_extra: event.target.value })} />
                    </label>
                    <div className="rounded-2xl border p-3 text-sm">
                      <p className="text-muted-foreground">自动计算配速</p>
                      <p className="mt-1 text-lg font-semibold">{computedPace}</p>
                    </div>
                    <label className="text-sm">
                      RPE
                      <Input type="number" min="1" max="10" value={form.rpe} onChange={(event) => setForm({ ...form, rpe: event.target.value })} />
                    </label>
                    <label className="text-sm">
                      睡眠时长
                      <Input type="number" min="0" max="24" step="0.1" value={form.sleep_hours} onChange={(event) => setForm({ ...form, sleep_hours: event.target.value })} />
                    </label>
                    <label className="text-sm">
                      体重（kg）
                      <Input type="number" min="1" step="0.1" value={form.body_weight_kg} onChange={(event) => setForm({ ...form, body_weight_kg: event.target.value })} />
                    </label>
                    <label className="text-sm">
                      疲劳 1-5
                      <Input type="number" min="1" max="5" value={form.fatigue_level} onChange={(event) => setForm({ ...form, fatigue_level: event.target.value })} />
                    </label>
                    <label className="text-sm">
                      疼痛部位
                      <Input value={form.pain_area} onChange={(event) => setForm({ ...form, pain_area: event.target.value })} placeholder="Calf / knee / foot" />
                    </label>
                    <label className="text-sm">
                      疼痛评分 0-10
                      <Input type="number" min="0" max="10" value={form.pain_score} onChange={(event) => setForm({ ...form, pain_score: event.target.value })} />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      备注
                      <Textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="How it felt, what broke down, or what went better than expected." />
                    </label>
                  </div>

                  <details className="rounded-2xl border p-4">
                    <summary className="cursor-pointer text-sm font-medium">Extra context</summary>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <label className="text-sm">
                        天气
                        <Input value={form.weather} onChange={(event) => setForm({ ...form, weather: event.target.value })} />
                      </label>
                      <label className="text-sm">
                        路面
                        <Input disabled placeholder="Reserved for a future update" />
                      </label>
                      <label className="text-sm sm:col-span-2">
                        分段 / 圈速备注
                        <Textarea disabled placeholder="后续可在这里补充分段配速与实际执行差异分析。" />
                      </label>
                    </div>
                  </details>

                  <Button type="submit" disabled={submitting} size="lg" className="w-full sm:w-auto">
                    <Save className="mr-2 h-4 w-4" />
                    {submitting ? "保存中..." : "保存训练记录"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
