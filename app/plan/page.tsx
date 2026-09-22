"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { ArrowRightLeft, Gauge, History, Plus, RotateCcw, Save, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { buildVersionWorkoutChanges } from "@/lib/services/plan-insights";
import type { PlanVersionSummary, TrainingPhase, WorkoutPlanSnapshot, WorkoutVersionChange } from "@/lib/types/training";

type PhasesResponse = { phases: TrainingPhase[] };
type VersionsResponse = { versions: PlanVersionSummary[] };
type ApiResponse<T> = { success?: boolean; data?: T; message?: string; error?: { message?: string } };

const emptyPhase = {
  phase_name: "",
  start_date: "",
  end_date: "",
  goal: "",
  weekly_mileage_min: "0",
  weekly_mileage_max: "0",
  training_days: "3",
  key_workouts: "",
  test_standard: "",
  ai_notes: "",
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

export default function PlanPage() {
  const [phases, setPhases] = useState<TrainingPhase[]>([]);
  const [timeline, setTimeline] = useState<PlanVersionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [form, setForm] = useState(emptyPhase);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [phasesResponse, versionsResponse] = await Promise.all([
        fetch("/api/phases", { cache: "no-store" }),
        fetch("/api/versions", { cache: "no-store" }),
      ]);

      const phasesJson = (await phasesResponse.json()) as ApiResponse<PhasesResponse>;
      const versionsJson = (await versionsResponse.json()) as ApiResponse<VersionsResponse>;

      if (!phasesResponse.ok || !phasesJson.success || !phasesJson.data) throw new Error(phasesJson.error?.message ?? "加载年度计划失败。");
      if (!versionsResponse.ok || !versionsJson.success || !versionsJson.data) throw new Error(versionsJson.error?.message ?? "加载计划时间线失败。");

      setPhases(phasesJson.data.phases ?? []);
      setTimeline((versionsJson.data.versions ?? []).filter((item) => item.target_table === "workouts" || item.target_table === "training_phases").slice(0, 8));
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络异常。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  function startEdit(phase: TrainingPhase) {
    setEditingId(phase.id);
    setForm({
      phase_name: phase.phase_name ?? "",
      start_date: phase.start_date ?? "",
      end_date: phase.end_date ?? "",
      goal: phase.goal ?? "",
      weekly_mileage_min: String(phase.weekly_mileage_min ?? 0),
      weekly_mileage_max: String(phase.weekly_mileage_max ?? 0),
      training_days: String(phase.training_days ?? 3),
      key_workouts: phase.key_workouts ?? "",
      test_standard: phase.test_standard ?? "",
      ai_notes: phase.ai_notes ?? "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const response = await fetch(editingId ? `/api/phases/${editingId}` : "/api/phases", {
        method: editingId ? "PUT" : "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok || !json.success) throw new Error(json.error?.message ?? "保存阶段失败。");
      setMessage(json.message ?? "阶段已保存。");
      setForm(emptyPhase);
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络异常。");
    }
  }

  async function remove(id: string) {
    const confirmed = window.confirm("确认删除这个训练阶段吗？这只会删除阶段记录，不会影响已有训练历史。");
    if (!confirmed) return;
    setMessage("");
    setError("");
    try {
      const response = await fetch(`/api/phases/${id}`, { method: "DELETE" });
      const json = (await response.json()) as ApiResponse<unknown>;
      if (!response.ok || !json.success) throw new Error(json.error?.message ?? "删除阶段失败。");
      setMessage(json.message ?? "阶段已删除。");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络异常。");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">年度训练计划</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              在这里管理训练阶段结构，并查看计划如何随着 AI 调整、导入恢复和手工修改不断演进。
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RotateCcw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </header>

        {message ? (
          <Card>
            <CardContent className="p-4 text-sm text-green-700">{message}</CardContent>
          </Card>
        ) : null}
        {error ? (
          <Card>
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{editingId ? "编辑训练阶段" : "新增训练阶段"}</CardTitle>
            <CardDescription>阶段目标、关键课、测试门槛和 AI 备注会一起解释这份计划的长期结构。</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="阶段名称" value={form.phase_name} onChange={(e) => setForm({ ...form, phase_name: e.target.value })} required />
              <Input type="number" min="1" max="7" placeholder="每周训练天数" value={form.training_days} onChange={(e) => setForm({ ...form, training_days: e.target.value })} required />
              <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} required />
              <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} required />
              <Input type="number" step="0.1" min="0" placeholder="周跑量下限（km）" value={form.weekly_mileage_min} onChange={(e) => setForm({ ...form, weekly_mileage_min: e.target.value })} required />
              <Input type="number" step="0.1" min="0" placeholder="周跑量上限（km）" value={form.weekly_mileage_max} onChange={(e) => setForm({ ...form, weekly_mileage_max: e.target.value })} required />
              <Textarea className="sm:col-span-2" placeholder="阶段目标" value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })} required />
              <Textarea className="sm:col-span-2" placeholder="关键训练" value={form.key_workouts} onChange={(e) => setForm({ ...form, key_workouts: e.target.value })} />
              <Textarea className="sm:col-span-2" placeholder="测试门槛 / 出阶段标准" value={form.test_standard} onChange={(e) => setForm({ ...form, test_standard: e.target.value })} />
              <Textarea className="sm:col-span-2" placeholder="AI 备注" value={form.ai_notes} onChange={(e) => setForm({ ...form, ai_notes: e.target.value })} />
              <div className="flex gap-2 sm:col-span-2">
                <Button type="submit">
                  <Save className="mr-2 h-4 w-4" />
                  {editingId ? "保存修改" : "新增阶段"}
                </Button>
                {editingId ? (
                  <Button type="button" variant="outline" onClick={() => { setEditingId(null); setForm(emptyPhase); }}>
                    取消编辑
                  </Button>
                ) : null}
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>计划演进时间线</CardTitle>
            <CardDescription>和版本页保持同样的摘要风格，不用先打开原始备份数据，也能看懂计划改了什么。</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {timeline.length === 0 ? <p className="text-sm text-muted-foreground">最近还没有计划演进记录。</p> : timeline.map((item) => (
              <Card key={item.id} className="border-dashed">
                <CardHeader>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CardTitle>{item.version_name}</CardTitle>
                        <Badge tone={changeTone(item.change_type)}>{item.change_type}</Badge>
                        <Badge tone="outline">{tableLabel(item.target_table)}</Badge>
                        {item.source_suggestion_type ? (
                          <Badge tone="outline">
                            <Sparkles className="mr-1 h-3 w-3" />
                            {item.source_suggestion_type}
                          </Badge>
                        ) : null}
                      </div>
                      <CardDescription>
                        {new Date(item.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })} | {item.change_reason ?? "没有记录手动说明。"}
                      </CardDescription>
                      {item.source_suggestion_text ? (
                        <p className="text-sm text-muted-foreground">AI 来源摘要：{item.source_suggestion_text}</p>
                      ) : null}
                    </div>
                    <div className="inline-flex items-center rounded-full border px-3 py-1 text-xs text-muted-foreground">
                      <History className="mr-2 h-3.5 w-3.5" />
                      计划快照
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const workoutChanges = buildVersionWorkoutChanges(item);
                    const keyChanges = workoutChanges.filter(isKeyWorkoutChange);
                    const secondaryChanges = workoutChanges.filter((change) => !isKeyWorkoutChange(change));
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
                              <div key={`${item.id}-${detail.workout_id ?? detail.workout_title}`} className={`rounded-2xl border p-4 ${visual.cardClass}`}>
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
                                  <div key={`${item.id}-secondary-${detail.workout_id ?? detail.workout_title}`} className={`rounded-2xl border p-4 ${visual.cardClass}`}>
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
                      <p className="mt-2 text-sm font-medium">{item.impact_summary ?? "计划快照已更新。"}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">训练改动数</p>
                      <p className="mt-2 text-2xl font-semibold">{item.changed_workout_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">阶段改动数</p>
                      <p className="mt-2 text-2xl font-semibold">{item.changed_phase_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border bg-muted/30 p-4">
                      <p className="text-xs uppercase tracking-wide text-muted-foreground">受影响日期</p>
                      <p className="mt-2 text-sm font-medium">{item.affected_dates?.join(", ") || "Not date-specific"}</p>
                    </div>
                  </div>

                  {item.highlights && item.highlights.length > 0 ? (
                    <div className="space-y-3">
                      {item.change_tags && item.change_tags.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {item.change_tags.map((tag) => (
                            <Badge key={tag} tone={tagTone(tag)}>
                              {tagLabel(tag)}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      <div className="grid gap-2">
                        {item.highlights.map((highlight) => (
                          <div key={highlight} className="rounded-xl border bg-background p-3 text-sm">
                            {highlight}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </CardContent>
        </Card>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">Loading plan data...</CardContent>
          </Card>
        ) : null}
        {!loading && phases.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">还没有训练阶段，可以先执行 seed，或者手动新增第一个年度阶段。</CardContent>
          </Card>
        ) : null}

        <div className="grid gap-4">
          {phases.map((phase) => (
            <Card key={phase.id}>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>{phase.phase_name}</CardTitle>
                      <Badge tone="secondary">{phase.start_date} to {phase.end_date}</Badge>
                    </div>
                    <CardDescription className="mt-2">
                      Weekly mileage {phase.weekly_mileage_min} - {phase.weekly_mileage_max} km | {phase.training_days} training days
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => startEdit(phase)}>
                      <Plus className="mr-2 h-4 w-4" />
                      编辑
                    </Button>
                    <Button variant="outline" size="sm" className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => void remove(phase.id)}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <div className="font-medium">阶段目标</div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{phase.goal}</p>
                </div>
                <div>
                  <div className="font-medium">关键训练</div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{phase.key_workouts || "无"}</p>
                </div>
                <div>
                  <div className="font-medium">测试门槛</div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{phase.test_standard || "无"}</p>
                </div>
                <div>
                  <div className="font-medium">AI 备注</div>
                  <p className="whitespace-pre-wrap text-muted-foreground">{phase.ai_notes || "无"}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
