"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { CalendarDays, Plus, RotateCcw, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cacheRecentWorkouts, getCachedRecentWorkouts } from "@/lib/browser/offline-store";
import { formatDistanceKm } from "@/lib/format";
import type { WorkoutWithLog } from "@/lib/types/training";

function parseDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function addDays(dateString: string, days: number) {
  const date = parseDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function label(dateString: string) {
  return new Intl.DateTimeFormat("zh-CN", { weekday: "short", month: "2-digit", day: "2-digit", timeZone: "UTC" }).format(parseDate(dateString));
}

type WeekData = { start: string; end: string; workouts: WorkoutWithLog[] };

const workoutTypeSeed = "轻松跑";

export default function WeekPage() {
  const [data, setData] = useState<WeekData | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    date: "",
    workout_type: workoutTypeSeed,
    title: "",
    planned_distance_km: "",
    planned_duration_min: "",
    planned_rpe: "3",
    purpose: "",
  });

  async function load(url = "/api/workouts") {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(url, { cache: "no-store" });
      const json = (await response.json()) as { success?: boolean; data?: WeekData; error?: { message?: string } };
      if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "读取周计划失败");
      const payload = json.data;
      setData(payload);
      setForm((old) => ({ ...old, date: old.date || payload.start }));

      if (url === "/api/workouts" || url.includes("/api/workouts?")) {
        void fetch("/api/offline/recent-workouts", { cache: "no-store" })
          .then((res) => res.json())
          .then((offlineJson) => { if (offlineJson.success) return cacheRecentWorkouts(offlineJson.data.workouts); })
          .catch(() => undefined);
      }
    } catch (err) {
      try {
        const cached = await getCachedRecentWorkouts();
        if (cached.length > 0) {
          setData({ start: cached[0].date, end: cached[cached.length - 1].date, workouts: cached as WorkoutWithLog[] });
          setError("当前离线，正在显示已缓存的最近训练计划。");
          return;
        }
      } catch {
        // ignore offline cache errors
      }
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const days = useMemo(() => data ? Array.from({ length: 7 }, (_, index) => addDays(data.start, index)) : [], [data]);
  const byDate = useMemo(() => {
    const map = new Map<string, WorkoutWithLog[]>();
    for (const day of days) map.set(day, []);
    for (const workout of data?.workouts ?? []) {
      if (!map.has(workout.date)) map.set(workout.date, []);
      map.get(workout.date)?.push(workout);
    }
    return map;
  }, [data, days]);

  async function updateWorkout(id: string, payload: Record<string, unknown>) {
    setMessage("");
    setError("");
    const response = await fetch(`/api/workouts/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await response.json() as { success?: boolean; message?: string; error?: { message?: string } };
    if (!response.ok || !json.success) throw new Error(json.error?.message ?? "更新失败");
    setMessage(json.message ?? "已更新");
    await load(data ? `/api/workouts?start=${data.start}&end=${data.end}` : "/api/workouts");
  }

  async function handleAdd(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          week_number: 1,
          workout_type: form.workout_type,
          title: form.title,
          planned_distance_km: Number(form.planned_distance_km || 0),
          planned_duration_min: Number(form.planned_duration_min || 0),
          planned_rpe: Number(form.planned_rpe || 3),
          purpose: form.purpose,
          strength_training: false,
        }),
      });
      const json = await response.json() as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !json.success) throw new Error(json.error?.message ?? "新增失败");
      setMessage("临时训练已新增");
      setShowAdd(false);
      setForm((old) => ({ ...old, title: "", planned_distance_km: "", planned_duration_min: "", purpose: "" }));
      await load(data ? `/api/workouts?start=${data.start}&end=${data.end}` : "/api/workouts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">周一到周日</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">周训练计划</h1>
            <p className="mt-1 text-sm text-muted-foreground">这里现在会直接显示哪些训练是被训练偏好重新排课或缩量过的。</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void load()} disabled={loading}><RotateCcw className="mr-2 h-4 w-4" />刷新</Button>
            <Button onClick={() => setShowAdd((value) => !value)}><Plus className="mr-2 h-4 w-4" />新增训练</Button>
          </div>
        </header>

        {message ? <Card><CardContent className="p-4 text-sm text-emerald-600">{message}</CardContent></Card> : null}
        {error ? <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card> : null}

        {showAdd ? (
          <Card>
            <CardHeader>
              <CardTitle>新增临时训练</CardTitle>
              <CardDescription>适合本周临时加课；批量计划和 AI 调整仍然会走完整的约束排课逻辑。</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-2" onSubmit={handleAdd}>
                <label className="text-sm">日期<Input value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} type="date" required /></label>
                <label className="text-sm">训练类型<Input value={form.workout_type} onChange={(e) => setForm({ ...form, workout_type: e.target.value })} required /></label>
                <label className="text-sm md:col-span-2">标题<Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="例如：轻松跑 5km" required /></label>
                <label className="text-sm">计划距离 km<Input value={form.planned_distance_km} onChange={(e) => setForm({ ...form, planned_distance_km: e.target.value })} type="number" min="0" step="0.1" /></label>
                <label className="text-sm">计划时间 min<Input value={form.planned_duration_min} onChange={(e) => setForm({ ...form, planned_duration_min: e.target.value })} type="number" min="0" /></label>
                <label className="text-sm">RPE<Input value={form.planned_rpe} onChange={(e) => setForm({ ...form, planned_rpe: e.target.value })} type="number" min="1" max="10" /></label>
                <label className="text-sm md:col-span-2">训练目的<Textarea value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} /></label>
                <div className="md:col-span-2"><Button type="submit">保存到数据库</Button></div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {loading ? <Card><CardContent className="p-6 text-sm text-muted-foreground">正在读取周计划...</CardContent></Card> : null}

        {!loading && data ? (
          <div className="grid gap-4 lg:grid-cols-7">
            {days.map((day) => (
              <Card key={day} className="lg:min-h-[280px]">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2 lg:block">
                    <CardTitle className="text-base">{label(day)}</CardTitle>
                    <CardDescription>{day}</CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {(byDate.get(day) ?? []).length === 0 ? (
                    <div className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">休息 / 暂无计划</div>
                  ) : (byDate.get(day) ?? []).map((workout) => (
                    <div key={workout.id} className="space-y-2 rounded-xl border bg-background p-3">
                      <div className="flex flex-wrap gap-1">
                        <Badge tone={workout.log?.completed || workout.completed ? "green" : workout.skipped ? "yellow" : "secondary"}>
                          {workout.log?.completed || workout.completed ? "已完成" : workout.skipped ? "已跳过" : "待完成"}
                        </Badge>
                        <Badge tone="outline">{workout.workout_type}</Badge>
                        {workout.is_preference_adjusted ? (
                          <Badge tone="orange">
                            <Sparkles className="mr-1 h-3 w-3" />
                            已按偏好校准
                          </Badge>
                        ) : null}
                      </div>
                      <p className="font-medium leading-snug">{workout.title}</p>
                      <p className="text-xs text-muted-foreground">{formatDistanceKm(workout.planned_distance_km)} / RPE {workout.planned_rpe ?? "未设置"}</p>
                      <p className="line-clamp-3 text-xs text-muted-foreground">{workout.purpose ?? workout.main_set ?? "无说明"}</p>
                      {workout.constraint_reasons && workout.constraint_reasons.length > 0 ? (
                        <div className="rounded-lg border border-orange-200 bg-orange-50 px-2 py-2 text-xs text-orange-700">
                          {workout.constraint_reasons.map((reason) => <p key={reason}>{reason}</p>)}
                        </div>
                      ) : null}
                      <div className="grid gap-2">
                        <Button asChild size="sm" className="w-full"><Link href={`/workout/${workout.id}`}>详情 / 打卡</Link></Button>
                        {!workout.log?.completed && !workout.skipped ? <Button size="sm" variant="outline" onClick={() => updateWorkout(workout.id, { skipped: true, completed: false }).catch((err) => setError(err.message))}>跳过</Button> : null}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}
