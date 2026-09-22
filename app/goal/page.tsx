"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Target, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { DashboardData } from "@/lib/types/training";

function secondsToText(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function GoalPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const json = await response.json() as { success?: boolean; data?: DashboardData; error?: { message?: string } };
      if (!response.ok || !json.success || !json.data) throw new Error(json?.error?.message ?? "读取目标失败");
      setData(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const improvement = useMemo(() => {
    const pb = data?.goal?.current_pb_seconds ?? 6156;
    const goal = data?.goal?.goal_time_seconds ?? 4890;
    return Math.max(0, pb - goal);
  }, [data]);

  const goalTitle = `${data?.goal?.target_race_name ?? "男子半程马拉松"} ${data?.goal?.goal_time_text ?? "1:21:30"}`;

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">唯一目标</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{goalTitle}</h1>
            <p className="mt-1 text-sm text-muted-foreground">目标日期为空时不报错；长期规划可暂按年底 12 月 31 日作为 AI 临时终点。</p>
          </div>
          <Button asChild variant="outline"><Link href="/settings">设置目标比赛</Link></Button>
        </header>

        {loading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">正在读取数据库...</CardContent></Card> : null}
        {error ? <Card><CardContent className="p-6 text-sm text-destructive">{error}</CardContent></Card> : null}

        {!loading && data ? (
          <>
            <Card className="border-primary/40">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  <CardTitle>目标概览</CardTitle>
                  <Badge tone="outline">国家三级运动员成绩目标</Badge>
                </div>
                <CardDescription>固定显示单一目标，不创建多目标系统。</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">目标成绩</p><p className="mt-1 text-2xl font-bold">{data.goal.goal_time_text ?? "1:21:30"}</p></div>
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">目标配速</p><p className="mt-1 text-2xl font-bold">{data.goal.goal_pace_text ?? "3'52\"/km"}</p></div>
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">当前 PB</p><p className="mt-1 text-2xl font-bold">{data.goal.current_pb_text ?? "1:42:36"}</p></div>
                <div className="rounded-xl border p-4"><p className="text-xs text-muted-foreground">需要提升</p><p className="mt-1 text-2xl font-bold">{secondsToText(improvement)}</p></div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader><CardTitle>目标比赛</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>目标比赛：{data.goal.target_race_name ?? "暂未确定"}</p>
                  <p>目标日期：{data.goal.target_race_date ?? "暂未确定"}</p>
                  <p>{data.goal.countdown_text ?? "目标比赛暂未设置"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>当前训练阶段</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium">{data.current_phase?.phase_name ?? "暂无阶段"}</p>
                  <p className="text-muted-foreground">{data.current_phase?.test_standard ?? "阶段门槛暂无"}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader><CardTitle>达标概率分析</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>第一版使用真实训练完成率、风险等级和测试成绩辅助判断，不编造概率。</p>
                  <p>当前风险：{data.risk?.risk_level ?? "—"}</p>
                  <p>最近 7 天完成率：{data.stats?.recent_7_day_completion_rate ?? 0}%</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  <CardTitle>AI 达标路径建议</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>AI 建议需要到 AI 教练页面基于最近 7/14/28 天真实数据生成并保存；不会在目标页自动覆盖计划。</p>
                <Button asChild><Link href="/ai-coach">进入 AI 教练</Link></Button>
              </CardContent>
            </Card>
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
