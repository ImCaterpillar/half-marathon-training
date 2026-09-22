"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  CloudSun,
  Dumbbell,
  Gauge,
  RotateCcw,
  ShieldAlert,
} from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDistanceKm, formatDuration, formatPace } from "@/lib/format";
import type { DashboardData, ExecutionQualitySummary, RiskLevel } from "@/lib/types/training";

const riskTone: Record<RiskLevel, RiskLevel> = { green: "green", yellow: "yellow", orange: "orange", red: "red" };
const riskLabel: Record<RiskLevel, string> = { green: "绿色", yellow: "黄色", orange: "橙色", red: "红色" };

function StatusCard({ title, value, description }: { title: string; value: string | number; description?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
      </CardHeader>
      {description ? <CardContent className="pt-0 text-sm text-muted-foreground">{description}</CardContent> : null}
    </Card>
  );
}

function qualityTone(status: ExecutionQualitySummary["dominant_status"]) {
  if (status === "stable") return "green" as const;
  if (status === "completed_hard") return "yellow" as const;
  if (status === "shortened") return "orange" as const;
  if (status === "overreached") return "red" as const;
  return "secondary" as const;
}

function qualityLabel(status: ExecutionQualitySummary["dominant_status"]) {
  if (status === "stable") return "大多按计划完成";
  if (status === "completed_hard") return "经常跑得偏重";
  if (status === "shortened") return "经常缩量完成";
  if (status === "overreached") return "经常超负荷";
  return "数据不足";
}

function getAdjustmentVisual(kind: DashboardData["recent_plan_adjustment"]["kind"]) {
  if (kind === "guardrail") {
    return {
      label: "保护性调整",
      tone: "yellow" as const,
      cardClass: "border-yellow-300 bg-yellow-50/70 dark:border-yellow-900 dark:bg-yellow-950/20",
      Icon: ShieldAlert,
    };
  }
  if (kind === "resized") {
    return {
      label: "缩放负荷",
      tone: "orange" as const,
      cardClass: "border-orange-300 bg-orange-50/70 dark:border-orange-900 dark:bg-orange-950/20",
      Icon: Gauge,
    };
  }
  if (kind === "moved") {
    return {
      label: "调整日期",
      tone: "secondary" as const,
      cardClass: "border-blue-300 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/20",
      Icon: ArrowRightLeft,
    };
  }
  return {
    label: kind === "none" ? "最近无调整" : "已调整",
    tone: "outline" as const,
    cardClass: "border-border bg-background",
    Icon: RotateCcw,
  };
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const json = (await response.json()) as { success?: boolean; data?: DashboardData; error?: { message?: string } };
      if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "加载仪表盘失败。");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络异常。");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const primaryWorkout = useMemo(() => data?.today_workouts[0] ?? null, [data]);

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{data?.today ?? "今天"}</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">今日训练简报</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              今天该练什么、当前风险背景如何，以及最近执行质量会怎样影响下一步安排。
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RotateCcw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </header>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">正在加载训练数据...</CardContent>
          </Card>
        ) : null}
        {error ? (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        {!loading && !error && data ? (
          <>
            <Card className="border-primary/40 shadow-md">
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={data.today_status === "completed" ? "green" : data.today_status === "skipped" ? "yellow" : "secondary"}>
                    {data.today_status === "empty" ? "今天无训练" : data.today_status === "completed" ? "已完成" : data.today_status === "skipped" ? "已跳过" : "可正常训练"}
                  </Badge>
                  <Badge tone={riskTone[data.risk.risk_level]}>{riskLabel[data.risk.risk_level]}风险</Badge>
                  {primaryWorkout?.strength_training ? (
                    <Badge tone="outline">
                      <Dumbbell className="mr-1 h-3 w-3" />
                      含力量训练
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-2xl sm:text-4xl">{data.today_brief.headline}</CardTitle>
                <CardDescription className="text-base">{data.today_brief.workout_title}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-5 md:grid-cols-[1.4fr,1fr]">
                <div className="space-y-3 text-sm leading-6">
                  <p><span className="font-medium">今天为什么练这堂课：</span>{data.today_brief.purpose}</p>
                  <p><span className="font-medium">今天重点：</span>{data.today_brief.focus}</p>
                  <p><span className="font-medium">注意事项：</span>{data.today_brief.caution}</p>
                  <p><span className="font-medium">教练建议：</span>{data.today_brief.recommendation}</p>
                  {data.today_brief.modified_workout_label ? (
                    <p className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-orange-700">
                      {data.today_brief.modified_workout_label}
                    </p>
                  ) : null}
                  {primaryWorkout?.log ? (
                    <p className="text-emerald-600">
                      已记录：{formatDistanceKm(primaryWorkout.log.actual_distance_km)} / {formatDuration(primaryWorkout.log.actual_duration_seconds)}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-3 rounded-xl border bg-muted/20 p-4 text-sm">
                  <p className="font-medium">计划训练</p>
                  {primaryWorkout ? (
                    <>
                      <p>类型：{primaryWorkout.workout_type}</p>
                      <p>距离：{formatDistanceKm(primaryWorkout.planned_distance_km)}</p>
                      <p>时长：{primaryWorkout.planned_duration_min ? `${primaryWorkout.planned_duration_min} 分钟` : "未设置"}</p>
                      <p>配速：{primaryWorkout.planned_pace_text ?? formatPace(primaryWorkout.planned_pace_seconds_per_km)}</p>
                      <p>RPE：{primaryWorkout.planned_rpe ?? "未设置"}</p>
                    </>
                  ) : (
                    <p className="text-muted-foreground">今天没有安排跑步训练，可以作为恢复或重置日。</p>
                  )}
                  <Button asChild size="lg" className="w-full">
                    <Link href={primaryWorkout ? `/workout/${primaryWorkout.id}` : "/week"}>
                      {primaryWorkout ? (primaryWorkout.log ? "查看或修改记录" : "完成今日记录") : "打开周视图"}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatusCard title="本周跑量" value={`${data.stats.weekly_mileage_km} km`} description={`计划 ${data.stats.planned_weekly_mileage_km} km`} />
              <StatusCard title="本月跑量" value={`${data.stats.monthly_mileage_km} km`} />
              <StatusCard title="本周训练天数" value={data.stats.weekly_training_days} />
              <StatusCard title="最近 7 天完成率" value={`${data.stats.recent_7_day_completion_rate}%`} description={`${data.stats.recent_7_day_completed_count}/${data.stats.recent_7_day_planned_count} 次`} />
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CloudSun className="h-4 w-4" />
                    <CardTitle>跑前状态</CardTitle>
                  </div>
                  <CardDescription>{data.readiness.recommendation}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>睡眠：{data.readiness.sleep_hours ? `${data.readiness.sleep_hours} 小时` : "暂无记录"}</p>
                  <p>疲劳：{data.readiness.fatigue_level ?? "暂无记录"}</p>
                  <p>疼痛：{data.readiness.pain_area ? `${data.readiness.pain_area} / ${data.readiness.pain_score ?? "-"}` : "暂无疼痛信号"}</p>
                  <p className="text-muted-foreground">{data.readiness.weather_note}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>本周教练摘要</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p><span className="font-medium">下一堂关键课：</span>{data.weekly_summary.next_key_workout}</p>
                  <p><span className="font-medium">执行趋势：</span>{data.weekly_summary.completion_trend}</p>
                  <p><span className="font-medium">训练偏好：</span>{data.weekly_summary.preference_summary}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>目标与阶段</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>当前 PB：{data.goal.current_pb_text ?? "未设置"}</p>
                  <p>目标成绩：{data.goal.goal_time_text ?? "未设置"}</p>
                  <p>目标配速：{data.goal.goal_pace_text ?? "未设置"}</p>
                  <p>{data.goal.countdown_text}</p>
                  <p>当前阶段：{data.current_phase?.phase_name ?? "暂无激活阶段"}</p>
                </CardContent>
              </Card>
            </div>

            {(() => {
              const visual = getAdjustmentVisual(data.recent_plan_adjustment.kind);
              const Icon = visual.Icon;
              return (
                <Card className={visual.cardClass}>
                  <CardHeader>
                    <div className="flex flex-wrap items-center gap-2">
                      <Icon className="h-5 w-5" />
                      <CardTitle>最近一次计划调整</CardTitle>
                      <Badge tone={visual.tone}>{visual.label}</Badge>
                    </div>
                    <CardDescription>{data.recent_plan_adjustment.summary}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <p>
                      <span className="font-medium">详情：</span>
                      {data.recent_plan_adjustment.detail}
                    </p>
                    {data.recent_plan_adjustment.version_name ? (
                      <p>
                        <span className="font-medium">来源版本：</span>
                        {data.recent_plan_adjustment.version_name}
                      </p>
                    ) : null}
                    {data.recent_plan_adjustment.created_at ? (
                      <p className="text-muted-foreground">
                        {new Date(data.recent_plan_adjustment.created_at).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" })}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })()}

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <Gauge className="h-5 w-5" />
                  <CardTitle>最近 7 天执行质量</CardTitle>
                  <Badge tone={qualityTone(data.recent_execution_quality.dominant_status)}>
                    {qualityLabel(data.recent_execution_quality.dominant_status)}
                  </Badge>
                </div>
                <CardDescription>{data.recent_execution_quality.headline}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-[1.2fr,1fr]">
                <div className="space-y-3 text-sm">
                  <p>{data.recent_execution_quality.summary}</p>
                  <p className="text-muted-foreground">{data.recent_execution_quality.recommendation}</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="green">按计划完成：{data.recent_execution_quality.counts.on_target}</Badge>
                    <Badge tone="yellow">完成但偏重：{data.recent_execution_quality.counts.completed_hard}</Badge>
                    <Badge tone="orange">缩量完成：{data.recent_execution_quality.counts.shortened}</Badge>
                    <Badge tone="red">超负荷：{data.recent_execution_quality.counts.overreached}</Badge>
                  </div>
                </div>
                <div className="rounded-xl border bg-muted/20 p-4">
                  <p className="text-sm text-muted-foreground">执行质量评分</p>
                  <p className="mt-2 text-4xl font-semibold">{data.recent_execution_quality.quality_score}/100</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    这个分数综合反映最近训练是大多按计划完成，还是逐渐偏向缩量、偏重或超负荷。
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  <CardTitle>风险说明与建议</CardTitle>
                  <Badge tone={riskTone[data.risk.risk_level]}>{riskLabel[data.risk.risk_level]}</Badge>
                </div>
                <CardDescription>{data.weekly_summary.risk_explanation}</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-sm font-medium">触发因素</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {data.risk.reasons.map((reason) => <li key={reason}>- {reason}</li>)}
                  </ul>
                </div>
                <div>
                  <p className="mb-2 text-sm font-medium">AI 每日建议</p>
                  <p className="text-sm text-muted-foreground">{data.ai_today_advice}</p>
                  {data.risk.should_modify_today ? (
                    <p className="mt-3 text-sm text-orange-600">当前建议是调整今天的训练内容，并优先恢复。</p>
                  ) : (
                    <p className="mt-3 flex items-center text-sm text-emerald-600">
                      <CheckCircle2 className="mr-1 h-4 w-4" />
                      当前规则判断今天可以按计划继续训练。
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
