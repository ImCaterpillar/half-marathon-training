"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Eye,
  Gauge,
  History,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type { DailyAdvice, PhaseReview, RiskAnalysis, WeeklyAdjustment } from "@/lib/ai/schemas";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildVersionDiffSnapshot } from "@/lib/services/plan-insights";
import type { AISuggestionHistoryItem, ExecutionQualitySummary, RiskLevel } from "@/lib/types/training";

type SuggestionMeta = {
  id: string;
  applied: boolean;
  risk_level?: RiskLevel | null;
  input_summary?: string | null;
};

type DailyResult = { type: "daily"; suggestion: SuggestionMeta; advice: DailyAdvice };
type WeeklyResult = { type: "weekly"; suggestion: SuggestionMeta; adjustment: WeeklyAdjustment };
type GenerateResult = { type: "generate"; suggestion: SuggestionMeta; plan: WeeklyAdjustment };
type PhaseResult = { type: "phase"; suggestion: SuggestionMeta; review: PhaseReview };
type RiskResult = { type: "risk"; suggestion: SuggestionMeta; analysis: RiskAnalysis };
type CoachResult = DailyResult | WeeklyResult | GenerateResult | PhaseResult | RiskResult;

type SuggestionContextSummary = {
  recent_execution_quality?: ExecutionQualitySummary;
};

type HistoryResponse = { suggestions: AISuggestionHistoryItem[] };

const riskLabel: Record<RiskLevel, string> = {
  green: "绿色",
  yellow: "黄色",
  orange: "橙色",
  red: "红色",
};

function qualityTone(status: ExecutionQualitySummary["dominant_status"]) {
  if (status === "stable") return "green" as const;
  if (status === "completed_hard") return "yellow" as const;
  if (status === "shortened") return "orange" as const;
  if (status === "overreached") return "red" as const;
  return "secondary" as const;
}

function qualityLabel(status: ExecutionQualitySummary["dominant_status"]) {
  if (status === "stable") return "执行稳定";
  if (status === "completed_hard") return "执行偏重";
  if (status === "shortened") return "执行缩量";
  if (status === "overreached") return "执行超负荷";
  return "数据不足";
}

function suggestionTypeLabel(type: string) {
  const labels: Record<string, string> = {
    "daily-advice": "每日建议",
    "weekly-adjustment": "周调整建议",
    "generate-plan": "生成计划",
    "phase-review": "阶段复盘",
    "risk-analysis": "风险分析",
  };
  return labels[type] ?? type;
}

function parseContextSummary(value: string | null | undefined): SuggestionContextSummary | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as SuggestionContextSummary;
  } catch {
    return null;
  }
}

function buildReplayResult(item: AISuggestionHistoryItem): CoachResult | null {
  if (!item.structured_plan) return null;
  const suggestion = {
    id: item.id,
    applied: item.applied,
    risk_level: item.risk_level,
    input_summary: item.input_summary,
  };

  if (item.suggestion_type === "daily-advice") {
    return { type: "daily", suggestion, advice: item.structured_plan as DailyAdvice };
  }
  if (item.suggestion_type === "weekly-adjustment") {
    return { type: "weekly", suggestion, adjustment: item.structured_plan as WeeklyAdjustment };
  }
  if (item.suggestion_type === "generate-plan") {
    return { type: "generate", suggestion, plan: item.structured_plan as WeeklyAdjustment };
  }
  if (item.suggestion_type === "phase-review") {
    return { type: "phase", suggestion, review: item.structured_plan as PhaseReview };
  }
  if (item.suggestion_type === "risk-analysis") {
    return { type: "risk", suggestion, analysis: item.structured_plan as RiskAnalysis };
  }
  return null;
}

function tagTone(tag: NonNullable<NonNullable<AISuggestionHistoryItem["related_versions"]>[number]["change_tags"]>[number]) {
  if (tag === "execution_guardrail") return "yellow" as const;
  if (tag === "preference_adjusted") return "orange" as const;
  if (tag === "moved_workouts" || tag === "resized_workouts") return "secondary" as const;
  return "outline" as const;
}

function tagLabel(tag: NonNullable<NonNullable<AISuggestionHistoryItem["related_versions"]>[number]["change_tags"]>[number]) {
  const labels: Record<NonNullable<NonNullable<AISuggestionHistoryItem["related_versions"]>[number]["change_tags"]>[number], string> = {
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

function VersionImpactCard({ item }: { item: NonNullable<AISuggestionHistoryItem["related_versions"]>[number] }) {
  const snapshot = buildVersionDiffSnapshot(item);
  return (
    <div className="rounded-xl border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={item.change_type === "ai" ? "green" : "secondary"}>{item.change_type}</Badge>
        <span className="font-medium">{item.version_name}</span>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">{snapshot.headline}</p>
      {snapshot.details.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {snapshot.details.map((detail) => (
            <Badge key={detail} tone="outline">{detail}</Badge>
          ))}
        </div>
      ) : null}
      {item.change_tags && item.change_tags.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {item.change_tags.slice(0, 3).map((tag) => (
            <Badge key={tag} tone={tagTone(tag)}>{tagLabel(tag)}</Badge>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function AICoachPage() {
  const [loadingTask, setLoadingTask] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [history, setHistory] = useState<AISuggestionHistoryItem[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [result, setResult] = useState<CoachResult | null>(null);
  const [replayedSuggestionId, setReplayedSuggestionId] = useState<string | null>(null);

  async function postJson<T>(url: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await response.json()) as { success?: boolean; data?: T; error?: { message?: string } };
    if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "请求失败。");
    return json.data;
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const response = await fetch("/api/ai/history", { cache: "no-store" });
      const json = (await response.json()) as { success?: boolean; data?: HistoryResponse; error?: { message?: string } };
      if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "加载 AI 历史失败。");
      setHistory(json.data.suggestions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "加载 AI 历史失败。");
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadHistory();
  }, []);

  async function generateDaily() {
    setLoadingTask("daily");
    setError("");
    setMessage("");
    try {
      const data = await postJson<{ suggestion: SuggestionMeta; advice: DailyAdvice }>("/api/ai/daily-advice");
      setResult({ type: "daily", ...data });
      setReplayedSuggestionId(null);
      setMessage("每日 AI 建议已保存，应用前请先确认。");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 建议暂时不可用。");
    } finally {
      setLoadingTask(null);
    }
  }

  async function generateWeekly() {
    setLoadingTask("weekly");
    setError("");
    setMessage("");
    try {
      const data = await postJson<{ suggestion: SuggestionMeta; adjustment: WeeklyAdjustment }>("/api/ai/weekly-adjustment");
      setResult({ type: "weekly", ...data });
      setReplayedSuggestionId(null);
      setMessage("每周 AI 调整已保存，应用前会自动创建版本备份。");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 建议暂时不可用。");
    } finally {
      setLoadingTask(null);
    }
  }

  async function generatePhase() {
    setLoadingTask("phase");
    setError("");
    setMessage("");
    try {
      const data = await postJson<{ suggestion: SuggestionMeta; review: PhaseReview }>("/api/ai/phase-review");
      setResult({ type: "phase", ...data });
      setReplayedSuggestionId(null);
      setMessage("阶段复盘已保存。");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 建议暂时不可用。");
    } finally {
      setLoadingTask(null);
    }
  }

  async function generateRisk() {
    setLoadingTask("risk");
    setError("");
    setMessage("");
    try {
      const data = await postJson<{ suggestion: SuggestionMeta; analysis: RiskAnalysis }>("/api/ai/risk-analysis");
      setResult({ type: "risk", ...data });
      setReplayedSuggestionId(null);
      setMessage("风险分析已保存。");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 建议暂时不可用。");
    } finally {
      setLoadingTask(null);
    }
  }

  async function generatePlan() {
    setLoadingTask("generate");
    setError("");
    setMessage("");
    try {
      const data = await postJson<{ suggestion: SuggestionMeta; plan: WeeklyAdjustment }>("/api/ai/generate-plan");
      setResult({ type: "generate", ...data });
      setReplayedSuggestionId(null);
      setMessage("生成计划已保存，应用前会自动创建版本备份。");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "AI 建议暂时不可用。");
    } finally {
      setLoadingTask(null);
    }
  }

  async function applySuggestion() {
    if (!result?.suggestion.id) return;

    const workoutCount =
      result.type === "daily"
        ? (result.advice.workout_adjustment.should_modify_today ? 1 : 0)
        : result.type === "weekly"
          ? result.adjustment.workouts.length
          : result.type === "generate"
            ? result.plan.workouts.length
            : 0;

    const confirmed = window.confirm(
      `确认应用这条 AI 建议吗？\n\n预计会新增或更新约 ${workoutCount} 条训练。\n应用前会自动创建 plan_versions 备份。\n如果应用失败，数据库事务会自动回滚。`
    );
    if (!confirmed) return;

    setLoadingTask("apply");
    setError("");
    setMessage("");

    try {
      const data = await postJson<{ version_id: string; applied_workouts_count: number }>("/api/ai/apply-suggestion", {
        suggestion_id: result.suggestion.id,
        change_reason: result.type === "daily" ? "User confirmed AI daily advice" : "User confirmed AI plan advice",
      });
      setMessage(`应用成功。备份版本：${data.version_id}。影响训练数：${data.applied_workouts_count}。`);
      setResult((current) => (current ? { ...current, suggestion: { ...current.suggestion, applied: true } } : current));
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "应用失败，数据库已自动回滚。");
    } finally {
      setLoadingTask(null);
    }
  }

  const structured = useMemo(() => {
    if (!result) return null;
    if (result.type === "daily") return result.advice;
    if (result.type === "weekly") return result.adjustment;
    if (result.type === "generate") return result.plan;
    if (result.type === "phase") return result.review;
    return result.analysis;
  }, [result]);

  const canApply = useMemo(() => {
    if (!result || result.suggestion.applied) return false;
    if (result.type === "daily") return result.advice.workout_adjustment.should_modify_today;
    if (result.type === "weekly") return result.adjustment.workouts.length > 0;
    if (result.type === "generate") return result.plan.workouts.length > 0;
    return false;
  }, [result]);

  const contextSummary = useMemo(() => parseContextSummary(result?.suggestion.input_summary), [result]);
  const executionQuality = contextSummary?.recent_execution_quality ?? null;
  const selectedHistoryItem = useMemo(
    () => (replayedSuggestionId ? history.find((item) => item.id === replayedSuggestionId) ?? null : null),
    [history, replayedSuggestionId]
  );

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">AI 教练</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI 教练</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              现在 AI 在给建议前，会同时参考训练偏好、本地风险和最近执行质量。
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadHistory()} disabled={historyLoading || loadingTask !== null}>
            <RotateCcw className="mr-2 h-4 w-4" />
            刷新历史
          </Button>
        </header>

        <Card className="border-orange-200 bg-orange-50/60 dark:border-orange-900 dark:bg-orange-950/20">
          <CardContent className="flex gap-3 p-4 text-sm text-orange-800 dark:text-orange-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <p>AI suggestions are training guidance, not medical diagnosis. Stop training and consult a professional if pain or injury risk is persistent.</p>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            { key: "daily", title: "每日建议", description: "结合今天的计划、恢复状态和最近执行质量，生成更稳妥的当日建议。", action: generateDaily, label: "生成每日建议" },
            { key: "weekly", title: "周调整建议", description: "生成下一周训练，并结合偏好和最近执行质量重新平衡安排。", action: generateWeekly, label: "生成周调整建议" },
            { key: "phase", title: "阶段复盘", description: "判断当前执行情况是否支持进入下一个训练阶段。", action: generatePhase, label: "生成阶段复盘" },
            { key: "risk", title: "风险分析", description: "解释疲劳、睡眠、疼痛和负荷风险，并判断最近执行偏差是否也是问题来源。", action: generateRisk, label: "生成风险分析" },
            { key: "generate", title: "生成计划", description: "先生成计划草案，再结合训练偏好和最近执行质量做约束校准。", action: generatePlan, label: "生成训练计划" },
          ].map((item) => (
            <Card key={item.key}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  {item.title}
                </CardTitle>
                <CardDescription>{item.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => void item.action()} disabled={loadingTask !== null} className="w-full sm:w-auto">
                  {loadingTask === item.key ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  {item.label}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {error ? (
          <Card>
            <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        {message ? (
          <Card>
            <CardContent className="flex gap-2 p-4 text-sm text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              {message}
            </CardContent>
          </Card>
        ) : null}

        {result && structured ? (
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Suggestion preview</CardTitle>
                {"risk_level" in structured ? <Badge tone={structured.risk_level}>{riskLabel[structured.risk_level]}</Badge> : null}
                {result.suggestion.applied ? <Badge tone="green">Applied</Badge> : <Badge tone="secondary">Not applied</Badge>}
                {selectedHistoryItem ? <Badge tone="outline">History replay</Badge> : null}
                {executionQuality ? (
                  <Badge tone={qualityTone(executionQuality.dominant_status)}>
                    {qualityLabel(executionQuality.dominant_status)}
                  </Badge>
                ) : null}
              </div>
              {"summary" in structured ? <CardDescription>{structured.summary}</CardDescription> : null}
            </CardHeader>

            <CardContent className="space-y-5">
              {executionQuality ? (
                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <Gauge className="h-4 w-4" />
                    <p className="font-medium">Recent execution quality influenced this suggestion</p>
                    <Badge tone={qualityTone(executionQuality.dominant_status)}>{executionQuality.quality_score}/100</Badge>
                  </div>
                  <p className="mt-2">{executionQuality.headline}</p>
                  <p className="mt-1 text-blue-800/80 dark:text-blue-100/80">{executionQuality.recommendation}</p>
                </div>
              ) : null}

              {selectedHistoryItem?.related_versions && selectedHistoryItem.related_versions.length > 0 ? (
                <div className="rounded-2xl border bg-muted/30 p-4 text-sm">
                  <p className="font-medium">Version impact from this suggestion</p>
                  <div className="mt-3 grid gap-2">
                    {selectedHistoryItem.related_versions.slice(0, 3).map((version) => (
                      <VersionImpactCard key={version.id} item={version} />
                    ))}
                  </div>
                </div>
              ) : null}

              {result.type === "daily" ? (
                <div className="space-y-3 text-sm">
                  <p><span className="font-medium">Recommendation: </span>{result.advice.recommendation}</p>
                  <p><span className="font-medium">Modify today: </span>{result.advice.workout_adjustment.should_modify_today ? "Yes" : "No"}</p>
                  <p><span className="font-medium">Adjustment notes: </span>{result.advice.workout_adjustment.new_notes ?? "None"}</p>
                  <div>
                    <p className="font-medium">Recovery advice</p>
                    <ul className="mt-1 space-y-1 text-muted-foreground">
                      {result.advice.recovery_advice.map((item) => <li key={item}>- {item}</li>)}
                    </ul>
                  </div>
                </div>
              ) : null}

              {result.type === "weekly" || result.type === "generate" ? (
                <div className="space-y-3">
                  <p className="text-sm">
                    <span className="font-medium">Recommended weekly distance: </span>
                    {result.type === "weekly" ? result.adjustment.weekly_mileage_recommendation.planned_km : result.plan.weekly_mileage_recommendation.planned_km} km
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[840px] text-sm">
                      <thead className="text-left text-muted-foreground">
                        <tr>
                          <th className="py-2">Date</th>
                          <th>Type</th>
                          <th>Title</th>
                          <th>Distance</th>
                          <th>Duration</th>
                          <th>RPE</th>
                          <th>Purpose / notes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.type === "weekly" ? result.adjustment.workouts : result.plan.workouts).map((workout) => (
                          <tr key={`${workout.date}-${workout.title}`} className="border-t">
                            <td className="py-2">{workout.date}</td>
                            <td>{workout.workout_type}</td>
                            <td>{workout.title}</td>
                            <td>{workout.planned_distance_km} km</td>
                            <td>{workout.planned_duration_min} min</td>
                            <td>{workout.planned_rpe ?? "Not set"}</td>
                            <td>{workout.notes ?? workout.purpose ?? "None"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    {(result.type === "weekly" ? result.adjustment.notes : result.plan.notes).length > 0
                      ? (result.type === "weekly" ? result.adjustment.notes : result.plan.notes).join(" ")
                      : "No extra constraint notes were generated for this plan."}
                  </div>
                </div>
              ) : null}

              {result.type === "phase" ? (
                <div className="space-y-3 text-sm">
                  <p><span className="font-medium">Enter next phase: </span>{result.review.can_enter_next_phase ? "Yes" : "Not yet"}</p>
                  {result.review.suggested_gate ? <p><span className="font-medium">Suggested gate: </span>{result.review.suggested_gate}</p> : null}
                  <ul className="space-y-1 text-muted-foreground">
                    {result.review.reasons.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              ) : null}

              {result.type === "risk" ? (
                <div className="space-y-3 text-sm">
                  <p><span className="font-medium">Recommended action: </span>{result.analysis.recommended_action}</p>
                  <ul className="space-y-1 text-muted-foreground">
                    {result.analysis.risk_reasons.map((item) => <li key={item}>- {item}</li>)}
                  </ul>
                </div>
              ) : null}

              {(result.type === "daily" || result.type === "weekly" || result.type === "generate") ? (
                <>
                  <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
                    Before apply: workouts will be created or updated, a version backup will be created, failures roll back, and the final plan will be re-constrained against preferences before write.
                  </div>
                  <Button onClick={() => void applySuggestion()} disabled={!canApply || loadingTask !== null}>
                    {loadingTask === "apply" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    应用到计划
                  </Button>
                </>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5" />
              <CardTitle>最近 AI 建议历史</CardTitle>
            </div>
            <CardDescription>Review what the AI suggested recently, whether it was applied, and what execution-quality context was present at the time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {historyLoading ? <p className="text-sm text-muted-foreground">正在加载 AI 建议历史...</p> : null}
            {!historyLoading && history.length === 0 ? <p className="text-sm text-muted-foreground">还没有 AI 建议记录。</p> : null}
            {history.map((item) => {
              const historyContext = parseContextSummary(item.input_summary);
              const historyExecution = historyContext?.recent_execution_quality ?? null;
              const replay = buildReplayResult(item);
              return (
                <div key={item.id} className="rounded-2xl border p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={item.risk_level ?? "secondary"}>{item.risk_level ? riskLabel[item.risk_level] : "No risk label"}</Badge>
                        <Badge tone="outline">{suggestionTypeLabel(item.suggestion_type)}</Badge>
                        {item.applied ? <Badge tone="green">Applied</Badge> : <Badge tone="secondary">Saved only</Badge>}
                        {historyExecution ? (
                          <Badge tone={qualityTone(historyExecution.dominant_status)}>
                            {qualityLabel(historyExecution.dominant_status)}
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-sm">{item.suggestion_text}</p>
                      <p className="text-xs text-muted-foreground">
                        Created {new Date(item.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                        {item.applied_at ? ` | Applied ${new Date(item.applied_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}` : ""}
                      </p>
                    </div>
                    {historyExecution ? (
                      <div className="rounded-xl border bg-muted/30 px-3 py-2 text-sm">
                        <p className="font-medium">{historyExecution.quality_score}/100</p>
                        <p className="text-muted-foreground">{historyExecution.headline}</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!replay}
                      onClick={() => {
                        if (!replay) return;
                        setResult(replay);
                        setReplayedSuggestionId(item.id);
                        setMessage("Loaded a saved AI suggestion back into preview so you can review it again.");
                        setError("");
                      }}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Replay preview
                    </Button>
                    {item.related_versions && item.related_versions.length > 0 ? (
                      <Badge tone="outline">Linked versions: {item.related_versions.length}</Badge>
                    ) : null}
                    {item.affected_dates && item.affected_dates.length > 0 ? (
                      <Badge tone="outline">Affected dates: {item.affected_dates.slice(0, 3).join(", ")}</Badge>
                    ) : null}
                  </div>

                  {item.related_versions && item.related_versions.length > 0 ? (
                    <>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {item.related_versions.slice(0, 3).map((version) => (
                          <Button key={version.id} asChild type="button" variant="outline" size="sm">
                            <Link href={`/versions#${version.id}`}>打开关联版本</Link>
                          </Button>
                        ))}
                      </div>
                      <div className="mt-3 grid gap-2">
                        {item.related_versions.slice(0, 2).map((version) => (
                          <VersionImpactCard key={version.id} item={version} />
                        ))}
                      </div>
                    </>
                  ) : null}

                  {item.related_workouts && item.related_workouts.length > 0 ? (
                    <div className="mt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Affected workouts</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.related_workouts.slice(0, 6).map((workout) => (
                          <Button key={workout.id} asChild type="button" variant="outline" size="sm">
                            <Link href={`/workout/${workout.id}`}>{workout.date} · {workout.title}</Link>
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
