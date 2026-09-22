"use client";

import type { ChangeEvent } from "react";
import { useEffect, useState } from "react";
import { ArrowRightLeft, Download, Gauge, History, RotateCcw, ShieldAlert, Sparkles, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildVersionWorkoutChanges } from "@/lib/services/plan-insights";
import type { PlanVersionSummary, WorkoutPlanSnapshot, WorkoutVersionChange } from "@/lib/types/training";

type VersionsResponse = {
  versions: PlanVersionSummary[];
};

type CsvPreview = {
  valid: boolean;
  preview?: {
    will_create?: number;
    will_update?: number;
  };
  rows?: unknown[];
};

type JsonPreview = {
  valid: boolean;
  summary?: {
    workout_count?: number;
    log_count?: number;
  };
};

type StructuredPreview = {
  valid: boolean;
  errors?: string[];
  meta?: {
    version?: string | null;
    exported_at?: string | null;
    workout_count?: number;
  };
  preview?: {
    will_create?: number;
    will_update?: number;
  };
};

type ApiResponse<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  error?: { message?: string };
};

function changeTone(changeType: PlanVersionSummary["change_type"]) {
  if (changeType === "ai") return "green" as const;
  if (changeType === "restore") return "orange" as const;
  if (changeType === "import") return "yellow" as const;
  return "secondary" as const;
}

function tableLabel(targetTable: PlanVersionSummary["target_table"]) {
  if (targetTable === "workouts") return "训练计划";
  if (targetTable === "training_phases") return "训练阶段";
  return "完整计划";
}

function safeMessage(message: string, fallback: string) {
  return message.trim() ? message : fallback;
}

function tagTone(tag: NonNullable<PlanVersionSummary["change_tags"]>[number]) {
  if (tag === "execution_guardrail") return "yellow" as const;
  if (tag === "preference_adjusted") return "orange" as const;
  if (tag === "moved_workouts" || tag === "resized_workouts") return "secondary" as const;
  return "outline" as const;
}

function tagLabel(tag: NonNullable<PlanVersionSummary["change_tags"]>[number]) {
  const labels: Record<NonNullable<PlanVersionSummary["change_tags"]>[number], string> = {
    added_workouts: "新增训练",
    removed_workouts: "删除训练",
    moved_workouts: "调整训练日期",
    resized_workouts: "调整训练负荷",
    preference_adjusted: "按偏好校准",
    execution_guardrail: "执行保护调整",
    phase_window_changed: "阶段窗口变化",
  };
  return labels[tag];
}

function formatSnapshotValue(snapshot: WorkoutPlanSnapshot | null, field: "date" | "distance" | "duration" | "rpe") {
  if (!snapshot) return "--";
  if (field === "date") return snapshot.date ?? "--";
  if (field === "distance") return `${snapshot.planned_distance_km} km`;
  if (field === "duration") return `${snapshot.planned_duration_min} min`;
  return snapshot.planned_rpe === null ? "--" : `RPE ${snapshot.planned_rpe}`;
}

function isKeyWorkoutChange(change: WorkoutVersionChange) {
  const beforeDate = change.before?.date ?? null;
  const afterDate = change.after?.date ?? null;
  const beforeDistance = change.before?.planned_distance_km ?? null;
  const afterDistance = change.after?.planned_distance_km ?? null;
  const beforeDuration = change.before?.planned_duration_min ?? null;
  const afterDuration = change.after?.planned_duration_min ?? null;
  const beforeRpe = change.before?.planned_rpe ?? null;
  const afterRpe = change.after?.planned_rpe ?? null;

  const moved = beforeDate !== afterDate;
  const resizedDistance = beforeDistance !== null && afterDistance !== null && Math.abs(beforeDistance - afterDistance) >= 1;
  const resizedDuration = beforeDuration !== null && afterDuration !== null && Math.abs(beforeDuration - afterDuration) >= 10;
  const effortChanged = beforeRpe !== afterRpe;
  const guarded = change.triggers.some((trigger) => trigger.includes("safeguard") || trigger.includes("constraint"));

  return moved || resizedDistance || resizedDuration || effortChanged || guarded;
}

function getChangeVisual(change: WorkoutVersionChange) {
  const beforeDate = change.before?.date ?? null;
  const afterDate = change.after?.date ?? null;
  const beforeDistance = change.before?.planned_distance_km ?? null;
  const afterDistance = change.after?.planned_distance_km ?? null;
  const beforeDuration = change.before?.planned_duration_min ?? null;
  const afterDuration = change.after?.planned_duration_min ?? null;
  const beforeRpe = change.before?.planned_rpe ?? null;
  const afterRpe = change.after?.planned_rpe ?? null;
  const moved = beforeDate !== afterDate;
  const resized =
    (beforeDistance !== null && afterDistance !== null && Math.abs(beforeDistance - afterDistance) >= 1) ||
    (beforeDuration !== null && afterDuration !== null && Math.abs(beforeDuration - afterDuration) >= 10) ||
    beforeRpe !== afterRpe;
  const guardrail = change.triggers.some((trigger) => trigger.includes("safeguard") || trigger.includes("constraint"));

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

export default function VersionsPage() {
  const [versions, setVersions] = useState<PlanVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [csvText, setCsvText] = useState("");
  const [csvPreview, setCsvPreview] = useState<CsvPreview | null>(null);
  const [jsonPayload, setJsonPayload] = useState<unknown | null>(null);
  const [jsonPreview, setJsonPreview] = useState<JsonPreview | null>(null);
  const [structuredPayload, setStructuredPayload] = useState<unknown | null>(null);
  const [structuredPreview, setStructuredPreview] = useState<StructuredPreview | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/versions", { cache: "no-store" });
      const json = (await response.json()) as ApiResponse<VersionsResponse>;
      if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "加载计划历史失败。");
      setVersions(json.data.versions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载计划历史失败。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function restore(id: string) {
    const confirmed = window.confirm("确认恢复这个版本并替换当前计划吗？");
    if (!confirmed) return;

    setError("");
    setMessage("");
    try {
      const response = await fetch(`/api/versions/${id}/restore`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirm: true, change_reason: "从版本历史恢复计划" }),
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok || !json.success) throw new Error(json.error?.message ?? "恢复版本失败。");
      setMessage(json.message ?? "版本已恢复。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to restore this version.");
    }
  }

  async function previewCsv() {
    setError("");
    setMessage("");
    const response = await fetch("/api/import/csv/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ csv_text: csvText }),
    });
    const json = (await response.json()) as ApiResponse<CsvPreview>;
    if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "CSV 预览失败。");
    setCsvPreview(json.data);
  }

  async function applyCsv() {
    if (!csvPreview?.valid) return;
    const createCount = csvPreview.preview?.will_create ?? 0;
    const updateCount = csvPreview.preview?.will_update ?? 0;
    const confirmed = window.confirm(`确认应用 CSV 导入吗？将新增 ${createCount} 条训练，更新 ${updateCount} 条训练。`);
    if (!confirmed) return;

    const response = await fetch("/api/import/csv/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true, rows: csvPreview.rows ?? [], change_reason: "应用训练 CSV 导入" }),
    });
    const json = (await response.json()) as ApiResponse<unknown>;
    if (!response.ok || !json.success) throw new Error(json.error?.message ?? "CSV 导入失败。");
    setMessage(json.message ?? "CSV 导入已应用。");
    setCsvPreview(null);
    setCsvText("");
    await load();
  }

  async function readJsonFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    setJsonPayload(parsed);

    const response = await fetch("/api/import/json/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ payload: parsed }),
    });
    const json = (await response.json()) as ApiResponse<JsonPreview>;
    if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "JSON 恢复预览失败。");
    setJsonPreview(json.data);
  }

  async function applyJson() {
    if (!jsonPayload || !jsonPreview?.valid) return;
    const confirmed = window.confirm("确认恢复上传的 JSON 备份吗？这会替换当前计划数据。");
    if (!confirmed) return;

    const response = await fetch("/api/import/json/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: true, payload: jsonPayload, change_reason: "从 JSON 备份恢复完整计划" }),
    });
    const json = (await response.json()) as ApiResponse<unknown>;
    if (!response.ok || !json.success) throw new Error(json.error?.message ?? "JSON 恢复失败。");
    setMessage(json.message ?? "JSON 恢复已应用。");
    setJsonPayload(null);
    setJsonPreview(null);
    await load();
  }

  async function readStructuredFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    const parsed = JSON.parse(text) as unknown;
    setStructuredPayload(parsed);

    const response = await fetch("/api/import/structured/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed),
    });
    const json = (await response.json()) as ApiResponse<StructuredPreview>;
    if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "结构化导入预览失败。");
    setStructuredPreview(json.data);
  }

  async function applyStructured() {
    if (!structuredPayload || !structuredPreview?.valid) return;
    const createCount = structuredPreview.preview?.will_create ?? 0;
    const updateCount = structuredPreview.preview?.will_update ?? 0;
    const confirmed = window.confirm(`确认应用结构化训练导入吗？将新增 ${createCount} 条训练，更新 ${updateCount} 条训练。`);
    if (!confirmed) return;

    const response = await fetch("/api/import/structured/apply", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(structuredPayload),
    });
    const json = (await response.json()) as ApiResponse<unknown>;
    if (!response.ok || !json.success) throw new Error(json.error?.message ?? "结构化导入失败。");
    setMessage(json.message ?? "结构化训练导入已应用。");
    setStructuredPayload(null);
    setStructuredPreview(null);
    await load();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">计划历史与恢复</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">版本时间线</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Review what changed, why it changed, and restore a previous state when a plan update does not work out.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RotateCcw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </header>

        {message ? (
          <Card>
            <CardContent className="p-4 text-sm text-emerald-700">{message}</CardContent>
          </Card>
        ) : null}
        {error ? (
          <Card>
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>训练 CSV 导入</CardTitle>
              <CardDescription>在把新训练写入计划前，先预览这次导入会带来什么影响。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Textarea
                className="min-h-40"
                placeholder="date,week_number,workout_type,title,planned_distance_km,planned_duration_min,planned_pace_text,planned_rpe,purpose,warmup,main_set,cooldown,strength_training,notes"
                value={csvText}
                onChange={(event) => setCsvText(event.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void previewCsv().catch((err: Error) => setError(err.message))}>
                  <Upload className="mr-2 h-4 w-4" />
                  预览 CSV
                </Button>
                <Button disabled={!csvPreview?.valid} onClick={() => void applyCsv().catch((err: Error) => setError(err.message))}>
                  应用导入
                </Button>
                <a className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium" href="/api/export/csv?type=workouts">
                  <Download className="mr-2 h-4 w-4" />
                  Export workouts
                </a>
              </div>
              {csvPreview ? (
                <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">预览结果</p>
                  <p className="mt-2 text-muted-foreground">
                    将新增 {csvPreview.preview?.will_create ?? 0} 条训练，更新 {csvPreview.preview?.will_update ?? 0} 条训练。
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Full backup restore</CardTitle>
              <CardDescription>Use JSON backups when you want to restore the full plan state, logs, and supporting records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <a className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium" href="/api/export/json">
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON backup
                </a>
                <a className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium" href="/api/export/csv?type=logs">
                  <Download className="mr-2 h-4 w-4" />
                  Export logs
                </a>
                <a className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium" href="/api/export/csv?type=body">
                  <Download className="mr-2 h-4 w-4" />
                  Export body metrics
                </a>
                <a className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium" href="/api/export/structured">
                  <Download className="mr-2 h-4 w-4" />
                  Export structured workouts
                </a>
              </div>
              <Input type="file" accept="application/json" onChange={(event) => void readJsonFile(event).catch((err: Error) => setError(err.message))} />
              <Button disabled={!jsonPreview?.valid} onClick={() => void applyJson().catch((err: Error) => setError(err.message))}>
                Restore JSON backup
              </Button>
              {jsonPreview ? (
                <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">Backup preview</p>
                  <p className="mt-2 text-muted-foreground">
                    训练：{jsonPreview.summary?.workout_count ?? 0} | 记录：{jsonPreview.summary?.log_count ?? 0}
                  </p>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Structured workout round-trip</CardTitle>
              <CardDescription>导出适合机器处理的训练计划快照，支持预览后再导回，并自动保留版本备份。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap gap-2">
                <a className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium" href="/api/export/structured">
                  <Download className="mr-2 h-4 w-4" />
                  Export structured workouts
                </a>
              </div>
              <Input type="file" accept="application/json" onChange={(event) => void readStructuredFile(event).catch((err: Error) => setError(err.message))} />
              <Button disabled={!structuredPreview?.valid} onClick={() => void applyStructured().catch((err: Error) => setError(err.message))}>
                Import structured workouts
              </Button>
              {structuredPreview ? (
                <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">Structured preview</p>
                  <p className="mt-2 text-muted-foreground">
                    版本：{structuredPreview.meta?.version ?? "未知"} | 训练：{structuredPreview.meta?.workout_count ?? 0}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    将新增 {structuredPreview.preview?.will_create ?? 0} 条训练，更新 {structuredPreview.preview?.will_update ?? 0} 条训练。
                  </p>
                  {structuredPreview.errors && structuredPreview.errors.length > 0 ? (
                    <div className="mt-2 space-y-1 text-destructive">
                      {structuredPreview.errors.map((item) => <p key={item}>{item}</p>)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Change timeline</CardTitle>
            <CardDescription>最新记录会排在最前面。建议先看摘要，只有需要原始备份细节时再展开快照。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? <p className="text-sm text-muted-foreground">Loading version history...</p> : null}
            {!loading && !error && versions.length === 0 ? (
              <p className="text-sm text-muted-foreground">还没有版本记录。AI 调整、导入和恢复都会自动创建备份。</p>
            ) : null}

            {versions.map((version) => (
              <Card key={version.id} id={version.id} className="border-dashed scroll-mt-24">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{version.version_name}</CardTitle>
                        <Badge tone={changeTone(version.change_type)}>{version.change_type}</Badge>
                        <Badge tone="outline">{tableLabel(version.target_table)}</Badge>
                        {version.source_suggestion_type ? (
                          <Badge tone="outline">
                            <Sparkles className="mr-1 h-3 w-3" />
                            {version.source_suggestion_type}
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription>
                        {new Date(version.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} |{" "}
                        {safeMessage(version.change_reason ?? "", "No manual reason was recorded.")}
                      </CardDescription>
                      {version.source_suggestion_text ? (
                        <p className="text-sm text-muted-foreground">AI source summary: {version.source_suggestion_text}</p>
                      ) : null}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void restore(version.id)}>
                      <History className="mr-2 h-4 w-4" />
                      Restore this point
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const workoutChanges = buildVersionWorkoutChanges(version);
                    const keyChanges = workoutChanges.filter(isKeyWorkoutChange);
                    const secondaryChanges = workoutChanges.filter((item) => !isKeyWorkoutChange(item));
                    return workoutChanges.length > 0 ? (
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">训练级别对比</p>
                          {keyChanges.length > 0 ? <Badge tone="secondary">{keyChanges.length} key changes</Badge> : null}
                          {secondaryChanges.length > 0 ? <Badge tone="outline">{secondaryChanges.length} secondary changes</Badge> : null}
                        </div>
                        <div className="space-y-3">
                          {(keyChanges.length > 0 ? keyChanges : workoutChanges).map((detail) => {
                            const visual = getChangeVisual(detail);
                            const Icon = visual.Icon;
                            return (
                              <div key={`${version.id}-${detail.workout_id ?? detail.workout_title}`} className={`rounded-2xl border p-4 ${visual.cardClass}`}>
                                <div className="flex flex-wrap items-center gap-2">
                                  <Badge tone={visual.tone}>
                                    <Icon className="mr-1 h-3 w-3" />
                                    {visual.label}
                                  </Badge>
                                  <p className="font-medium">{detail.workout_title}</p>
                                  {detail.workout_type ? <Badge tone="outline">{detail.workout_type}</Badge> : null}
                                </div>
                                <div className="mt-3 grid gap-3 md:grid-cols-4">
                                  <div className="rounded-2xl bg-muted/40 p-3">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">日期</p>
                                    <p className="mt-2 text-sm font-medium">
                                      {formatSnapshotValue(detail.before, "date")} {"->"} {formatSnapshotValue(detail.after, "date")}
                                    </p>
                                  </div>
                                  <div className="rounded-2xl bg-muted/40 p-3">
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">距离</p>
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
                                    <p className="text-xs uppercase tracking-wide text-muted-foreground">强度</p>
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
                              </div>
                            );
                          })}
                        </div>
                        {secondaryChanges.length > 0 && keyChanges.length > 0 ? (
                          <details className="rounded-2xl border p-4">
                            <summary className="cursor-pointer text-sm font-medium">上方仅展示关键变化，展开可查看其余改动。</summary>
                            <div className="mt-4 space-y-3">
                              {secondaryChanges.map((detail) => {
                                const visual = getChangeVisual(detail);
                                const Icon = visual.Icon;
                                return (
                                  <div key={`${version.id}-secondary-${detail.workout_id ?? detail.workout_title}`} className={`rounded-2xl border p-4 ${visual.cardClass}`}>
                                    <div className="flex flex-wrap items-center gap-2">
                                      <Badge tone={visual.tone}>
                                        <Icon className="mr-1 h-3 w-3" />
                                        {visual.label}
                                      </Badge>
                                      <p className="font-medium">{detail.workout_title}</p>
                                      {detail.workout_type ? <Badge tone="outline">{detail.workout_type}</Badge> : null}
                                    </div>
                                    <div className="mt-3 grid gap-3 md:grid-cols-4">
                                      <div className="rounded-2xl bg-muted/40 p-3">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">日期</p>
                                        <p className="mt-2 text-sm font-medium">
                                          {formatSnapshotValue(detail.before, "date")} {"->"} {formatSnapshotValue(detail.after, "date")}
                                        </p>
                                      </div>
                                      <div className="rounded-2xl bg-muted/40 p-3">
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">距离</p>
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
                                        <p className="text-xs uppercase tracking-wide text-muted-foreground">强度</p>
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
                                  </div>
                                );
                              })}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ) : null;
                  })()}

                  <div className="grid gap-3 lg:grid-cols-4">
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">影响摘要</p>
                      <p className="mt-2 text-sm font-medium">{version.impact_summary ?? "计划快照已更新。"}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">训练改动数</p>
                      <p className="mt-2 text-2xl font-semibold">{version.changed_workout_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">阶段改动数</p>
                      <p className="mt-2 text-2xl font-semibold">{version.changed_phase_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">受影响日期</p>
                      <p className="mt-2 text-sm font-medium">{version.affected_dates?.join(", ") || "Not date-specific"}</p>
                    </div>
                  </div>

                  {version.highlights && version.highlights.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">What changed</p>
                      {version.change_tags && version.change_tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {version.change_tags.map((tag) => (
                            <Badge key={tag} tone={tagTone(tag)}>
                              {tagLabel(tag)}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <div className="grid gap-2">
                        {version.highlights.map((item) => (
                          <div key={item} className="rounded-xl border bg-background p-3 text-sm">
                            {item}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {(version.before_data || version.after_data) ? (
                    <details className="rounded-2xl border p-4">
                      <summary className="cursor-pointer text-sm font-medium">原始备份快照</summary>
                      <div className="mt-4 grid gap-4 lg:grid-cols-2">
                        <div>
                          <p className="mb-2 text-sm font-medium">变更前</p>
                          <pre className="max-h-80 overflow-auto rounded-xl bg-muted p-3 text-xs">
                            {JSON.stringify(version.before_data ?? null, null, 2)}
                          </pre>
                        </div>
                        <div>
                          <p className="mb-2 text-sm font-medium">变更后</p>
                          <pre className="max-h-80 overflow-auto rounded-xl bg-muted p-3 text-xs">
                            {JSON.stringify(version.after_data ?? null, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </details>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
