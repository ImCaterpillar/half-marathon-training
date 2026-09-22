"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, RotateCcw, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { WorkoutWithLog } from "@/lib/types/training";

function parseDate(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = parseDate(dateString);
  date.setUTCDate(date.getUTCDate() + days);
  return toDateOnly(date);
}

function startOfMonth(month: string) {
  return `${month}-01`;
}

function endOfMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return toDateOnly(new Date(Date.UTC(year, monthNumber, 0)));
}

function shiftMonth(month: string, diff: number) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + diff, 1));
  return date.toISOString().slice(0, 7);
}

function gridStart(month: string) {
  const first = startOfMonth(month);
  const date = parseDate(first);
  const day = date.getUTCDay() || 7;
  return addDays(first, -day + 1);
}

function todayMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? new Date().getUTCFullYear().toString();
  const monthPart = parts.find((part) => part.type === "month")?.value ?? "01";
  return `${year}-${monthPart}`;
}

const typeTone: Record<string, "secondary" | "green" | "yellow" | "orange" | "red"> = {
  轻松跑: "green",
  恢复跑: "green",
  long_run: "orange",
  长距离: "orange",
  测试: "red",
  间歇: "red",
  tempo: "orange",
  节奏跑: "orange",
  力量: "yellow",
};

type WorkoutResponse = { start: string; end: string; workouts: WorkoutWithLog[] };

export default function CalendarPage() {
  const [month, setMonth] = useState(todayMonth());
  const [workouts, setWorkouts] = useState<WorkoutWithLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ date: startOfMonth(todayMonth()), workout_type: "轻松跑", title: "", planned_distance_km: "", planned_duration_min: "", planned_rpe: "3" });

  async function load(targetMonth = month) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/workouts?start=${startOfMonth(targetMonth)}&end=${endOfMonth(targetMonth)}&limit=370`, { cache: "no-store" });
      const json = (await response.json()) as { success?: boolean; data?: WorkoutResponse; error?: { message?: string } };
      if (!response.ok || !json.success || !json.data) throw new Error(json.error?.message ?? "读取日历失败");
      setWorkouts(json.data.workouts ?? []);
      setForm((old) => ({ ...old, date: old.date || startOfMonth(targetMonth) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load(month);
  }, [month]);

  const days = useMemo(() => {
    const start = gridStart(month);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [month]);

  const byDate = useMemo(() => {
    const map = new Map<string, WorkoutWithLog[]>();
    for (const day of days) map.set(day, []);
    for (const workout of workouts) {
      if (!map.has(workout.date)) map.set(workout.date, []);
      map.get(workout.date)?.push(workout);
    }
    return map;
  }, [workouts, days]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const response = await fetch("/api/workouts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...form, week_number: 1, purpose: "日历快速新增" }),
      });
      const json = await response.json() as { success?: boolean; error?: { message?: string } };
      if (!response.ok || !json.success) throw new Error(json.error?.message ?? "新增失败");
      setMessage("训练已新增");
      setShowAdd(false);
      setForm({ ...form, title: "", planned_distance_km: "", planned_duration_min: "" });
      await load(month);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">日历视图</h1>
            <p className="mt-1 text-sm text-muted-foreground">月历里现在也能一眼看出哪些训练被偏好约束重排过。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setMonth(shiftMonth(month, -1))}><ChevronLeft className="mr-1 h-4 w-4" />上月</Button>
            <Button variant="outline" onClick={() => setMonth(todayMonth())}>{month}</Button>
            <Button variant="outline" onClick={() => setMonth(shiftMonth(month, 1))}>下月<ChevronRight className="ml-1 h-4 w-4" /></Button>
            <Button onClick={() => setShowAdd((value) => !value)}><Plus className="mr-2 h-4 w-4" />快速新增</Button>
            <Button variant="outline" onClick={() => void load(month)} disabled={loading}><RotateCcw className="mr-2 h-4 w-4" />刷新</Button>
          </div>
        </header>

        {message ? <Card><CardContent className="p-4 text-sm text-green-700">{message}</CardContent></Card> : null}
        {error ? <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card> : null}

        {showAdd ? (
          <Card>
            <CardHeader>
              <CardTitle>快速新增训练</CardTitle>
              <CardDescription>用于临时添加训练课；AI 自动计划仍会走完整的偏好约束排课。</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submit} className="grid gap-3 sm:grid-cols-6">
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                <Input placeholder="类型" value={form.workout_type} onChange={(e) => setForm({ ...form, workout_type: e.target.value })} required />
                <Input className="sm:col-span-2" placeholder="标题" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                <Input type="number" step="0.1" min="0" placeholder="km" value={form.planned_distance_km} onChange={(e) => setForm({ ...form, planned_distance_km: e.target.value })} />
                <Input type="number" min="0" placeholder="分钟" value={form.planned_duration_min} onChange={(e) => setForm({ ...form, planned_duration_min: e.target.value })} />
                <Button className="sm:col-span-6" type="submit">保存训练</Button>
              </form>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{month} 训练日历</CardTitle>
            <CardDescription>高强度、长距离、测试日会突出显示；被偏好约束调整过的训练会带闪光标记。</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="p-6 text-sm text-muted-foreground">正在读取数据库...</div> : null}
            <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
              {["一", "二", "三", "四", "五", "六", "日"].map((day) => <div key={day} className="py-2">周{day}</div>)}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const list = byDate.get(day) ?? [];
                const outside = !day.startsWith(month);
                return (
                  <div key={day} className={`min-h-28 rounded-lg border bg-background p-2 text-left ${outside ? "opacity-40" : ""}`}>
                    <div className="mb-2 text-xs font-semibold">{day.slice(5)}</div>
                    <div className="space-y-1">
                      {list.map((workout) => {
                        const statusTone = workout.log?.completed || workout.completed ? "green" : workout.skipped ? "yellow" : typeTone[workout.workout_type] ?? "secondary";
                        const isSpecial = ["测试", "间歇", "长距离", "节奏跑", "tempo", "long_run"].some((keyword) => `${workout.workout_type}${workout.title}`.includes(keyword));
                        return (
                          <Link key={workout.id} href={`/workout/${workout.id}`} className="block rounded-md border p-1 hover:bg-muted">
                            <div className="flex items-center gap-1">
                              <Badge tone={statusTone}>{workout.log?.completed || workout.completed ? "完成" : workout.skipped ? "跳过" : workout.workout_type}</Badge>
                              {isSpecial ? <span className="text-xs text-destructive">★</span> : null}
                              {workout.is_preference_adjusted ? <Sparkles className="h-3 w-3 text-orange-500" /> : null}
                            </div>
                            <div className="mt-1 line-clamp-2 text-xs font-medium">{workout.title}</div>
                            {workout.constraint_reasons && workout.constraint_reasons.length > 0 ? (
                              <div className="mt-1 line-clamp-2 text-[10px] text-orange-700">{workout.constraint_reasons[0]}</div>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
