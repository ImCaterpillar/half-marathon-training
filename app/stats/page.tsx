"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  Activity,
  Gauge,
  RotateCcw,
  Target,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatPace } from "@/lib/format";
import type { StatsData, WorkoutExecutionReview } from "@/lib/types/training";

type StatsResponse = { success?: boolean; data?: StatsData; error?: { message?: string } };

function EmptyChart({ text = "暂无图表数据。" }: { text?: string }) {
  return <div className="flex h-64 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">{text}</div>;
}

function ChartCard({
  title,
  description,
  children,
  empty,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  empty?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>{empty ? <EmptyChart /> : children}</CardContent>
    </Card>
  );
}

function MetricCard({ title, value, description }: { title: string; value: string; description?: string }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
    </Card>
  );
}

function reviewTone(status: WorkoutExecutionReview["status"]) {
  if (status === "on_target") return "green" as const;
  if (status === "completed_hard") return "yellow" as const;
  if (status === "shortened") return "orange" as const;
  if (status === "overreached") return "red" as const;
  return "secondary" as const;
}

function reviewColor(status: WorkoutExecutionReview["status"]) {
  if (status === "on_target") return "#10b981";
  if (status === "completed_hard") return "#f59e0b";
  if (status === "shortened") return "#f97316";
  if (status === "overreached") return "#ef4444";
  return "#94a3b8";
}

export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/stats", { cache: "no-store" });
      const json = (await response.json()) as StatsResponse;
      if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "加载统计失败。");
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

  const qualitySummary = data?.completion_quality_summary
    ? [
        { label: "按计划完成", value: data.completion_quality_summary.on_target, status: "on_target" as const },
        { label: "完成但偏重", value: data.completion_quality_summary.completed_hard, status: "completed_hard" as const },
        { label: "缩量完成", value: data.completion_quality_summary.shortened, status: "shortened" as const },
        { label: "超负荷", value: data.completion_quality_summary.overreached, status: "overreached" as const },
      ]
    : [];

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">训练分析</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">统计分析</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              这里不只看你练了多少，也看每次完成后的训练是否真正符合原计划负荷。
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RotateCcw className="mr-2 h-4 w-4" />
            刷新
          </Button>
        </header>

        {loading ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">正在加载统计数据...</CardContent>
          </Card>
        ) : null}
        {error ? (
          <Card>
            <CardContent className="p-6 text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : null}

        {!loading && data ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard title="计划训练数" value={`${data.summary.planned_workouts}`} />
              <MetricCard title="已完成训练数" value={`${data.summary.completed_workouts}`} />
              <MetricCard title="完成率" value={`${data.summary.completion_rate}%`} />
              <MetricCard title="累计跑量" value={`${data.summary.total_actual_km} km`} />
            </div>

            {data.readiness_load ? (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Gauge className="h-5 w-5" />
                      恢复与负荷
                    </CardTitle>
                    <CardDescription>{data.readiness_load.recommendation}</CardDescription>
                  </CardHeader>
                  <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground">疲劳</p>
                      <p className="text-2xl font-semibold">{data.readiness_load.fatigue_score}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground">平均睡眠</p>
                      <p className="text-2xl font-semibold">{data.readiness_load.sleep_score} h</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-muted-foreground">连续性</p>
                      <p className="text-2xl font-semibold">{data.readiness_load.consistency_score}%</p>
                    </div>
                  </CardContent>
                </Card>

                <Card className="lg:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Activity className="h-5 w-5" />
                      重复训练对比
                    </CardTitle>
                    <CardDescription>对比最近长距离、节奏跑、间歇和轻松跑这些训练到底是怎么被执行的。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {data.workout_type_comparison && data.workout_type_comparison.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full min-w-[720px] text-sm">
                          <thead className="text-left text-muted-foreground">
                            <tr>
                              <th className="py-2">训练类型</th>
                              <th>次数</th>
                              <th>平均距离</th>
                              <th>平均 RPE</th>
                              <th>平均配速</th>
                            </tr>
                          </thead>
                          <tbody>
                            {data.workout_type_comparison.map((row) => (
                              <tr key={row.workout_type} className="border-t">
                                <td className="py-2">{row.workout_type}</td>
                                <td>{row.count}</td>
                                <td>{row.avg_distance_km} km</td>
                                <td>{row.avg_rpe ?? "--"}</td>
                                <td>{row.avg_pace_seconds_per_km ? formatPace(row.avg_pace_seconds_per_km) : "--"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <EmptyChart text="重复训练类型数据还不够。" />
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : null}

            <div className="grid gap-4 xl:grid-cols-2">
              <ChartCard
                title="完成质量趋势"
                description="训练即使完成了，也可能没达到计划负荷。这里会展示最近训练更偏向按计划、偏重、缩量还是超负荷。"
                empty={!data.completion_quality_trend || data.completion_quality_trend.length === 0}
              >
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.completion_quality_trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => [`${value}/100`, "质量评分"]} />
                      <Line type="monotone" dataKey="score" name="质量评分" stroke="#0f172a" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard
                title="完成质量分布"
                description="这张分布图能帮助你快速看出最近训练是否在逐渐偏向超负荷或反复缩量完成。"
                empty={qualitySummary.length === 0 || qualitySummary.every((item) => item.value === 0)}
              >
                <div className="space-y-4">
                  <div className="h-56">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip />
                        <Pie data={qualitySummary} dataKey="value" nameKey="label" outerRadius={90} label>
                          {qualitySummary.map((entry) => (
                            <Cell key={entry.label} fill={reviewColor(entry.status)} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {qualitySummary.map((item) => (
                      <Badge key={item.label} tone={reviewTone(item.status)}>
                        {item.label}: {item.value}
                      </Badge>
                    ))}
                  </div>
                </div>
              </ChartCard>

              {data.completion_quality_trend && data.completion_quality_trend.length > 0 ? (
                <Card className="xl:col-span-2">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="h-5 w-5" />
                      最近执行回顾
                    </CardTitle>
                    <CardDescription>最近几次训练会按照它们和计划负荷的匹配程度进行评分。</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {data.completion_quality_trend.slice(-6).reverse().map((item) => (
                        <div key={`${item.date}-${item.title}`} className="rounded-2xl border p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-medium">{item.title}</p>
                              <p className="text-xs text-muted-foreground">{item.date}</p>
                            </div>
                            <Badge tone={reviewTone(item.status)}>{item.status.replace("_", " ")}</Badge>
                          </div>
                          <p className="mt-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">{item.pattern_label}</p>
                          <p className="mt-3 text-sm text-muted-foreground">{item.headline}</p>
                          <p className="mt-3 text-2xl font-semibold">{item.score}/100</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <ChartCard title="周跑量趋势" description="每周计划跑量与实际跑量对比" empty={data.weekly_mileage_trend.length === 0}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.weekly_mileage_trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week_start" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="planned_km" name="计划 km" />
                      <Bar dataKey="actual_km" name="实际 km" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="月跑量趋势" empty={data.monthly_mileage_trend.length === 0}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.monthly_mileage_trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="month" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="planned_km" name="计划 km" />
                      <Bar dataKey="actual_km" name="实际 km" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="配速趋势" description="单位是每公里秒数，越低代表越快" empty={data.pace_trend.length === 0}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.pace_trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value) => formatPace(value)} />
                      <Line type="monotone" dataKey="pace_seconds_per_km" name="配速" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="训练类型分布" empty={data.type_distribution.length === 0}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Tooltip />
                      <Pie data={data.type_distribution} dataKey="count" nameKey="workout_type" outerRadius={96} label />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="睡眠趋势" empty={data.sleep_trend.length === 0}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.sleep_trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="sleep_hours" name="Hours" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="疲劳趋势" empty={data.fatigue_trend.length === 0}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.fatigue_trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="fatigue_level" name="疲劳 1-5" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Weight trend" empty={data.weight_trend.length === 0}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.weight_trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="weight_kg" name="kg" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="RPE vs distance" description="Watch whether higher subjective effort is also pairing with bigger distance" empty={data.rpe_mileage.length === 0}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.rpe_mileage}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="distance_km" name="Distance km" />
                      <Bar dataKey="rpe" name="RPE" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Test result trend" description="Based on test_results performance checkpoints" empty={data.test_trend.length === 0}>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.test_trend}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" />
                      <YAxis />
                      <Tooltip formatter={(value, _name, item) => (item?.dataKey === "avg_pace_seconds_per_km" ? formatPace(value) : value)} />
                      <Line type="monotone" dataKey="avg_pace_seconds_per_km" name="Test avg pace" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
