"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RotateCcw, Save } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function defaultRecoveryScore(sleep: string, fatigue: string, pain: string) {
  const sleepHours = Number(sleep || 0);
  const fatigueLevel = Number(fatigue || 3);
  const painScore = Number(pain || 0);
  const score = Math.round(60 + Math.min(20, sleepHours * 3) - Math.max(0, fatigueLevel - 3) * 8 - painScore * 5);
  return String(Math.max(0, Math.min(100, score)));
}

function todayChina() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

const defaultForm = {
  date: todayChina(),
  weight_kg: "",
  sleep_hours: "",
  fatigue_level: "3",
  pain_area: "",
  pain_score: "0",
  resting_hr: "",
  recovery_score: "",
  ai_recovery_advice: "",
  notes: "",
};

type Metric = any;

export default function BodyPage() {
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/body?limit=120", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json?.error?.message ?? "读取体重恢复数据失败");
      setMetrics(json.data.metrics ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function patch(next: Partial<typeof form>) {
    const merged = { ...form, ...next };
    if (!merged.recovery_score) {
      merged.recovery_score = defaultRecoveryScore(merged.sleep_hours, merged.fatigue_level, merged.pain_score);
    }
    setForm(merged);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const payload = { ...form, recovery_score: form.recovery_score || defaultRecoveryScore(form.sleep_hours, form.fatigue_level, form.pain_score) };
      const response = await fetch("/api/body", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json?.error?.message ?? "保存失败");
      setMessage("体重恢复记录已保存");
      setForm(defaultForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    }
  }

  const chartData = useMemo(() => [...metrics].reverse().map((item) => ({ date: item.date, weight: item.weight_kg, sleep: item.sleep_hours, fatigue: item.fatigue_level, pain: item.pain_score, recovery: item.recovery_score })), [metrics]);
  const latest = metrics[0];

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">体重与恢复</h1>
            <p className="mt-1 text-sm text-muted-foreground">记录体重、睡眠、疲劳、疼痛和恢复评分，写入 body_metrics。</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}><RotateCcw className="mr-2 h-4 w-4" />刷新</Button>
        </header>

        {message ? <Card><CardContent className="p-4 text-sm text-green-700">{message}</CardContent></Card> : null}
        {error ? <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card> : null}

        <div className="grid gap-4 sm:grid-cols-4">
          <Card><CardHeader><CardDescription>最新体重</CardDescription><CardTitle>{latest?.weight_kg ? `${latest.weight_kg} kg` : "暂无"}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>最新睡眠</CardDescription><CardTitle>{latest?.sleep_hours ? `${latest.sleep_hours} h` : "暂无"}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>疲劳程度</CardDescription><CardTitle>{latest?.fatigue_level ?? "暂无"}</CardTitle></CardHeader></Card>
          <Card><CardHeader><CardDescription>恢复评分</CardDescription><CardTitle>{latest?.recovery_score ?? "暂无"}</CardTitle></CardHeader></Card>
        </div>

        <Card>
          <CardHeader><CardTitle>新增恢复记录</CardTitle><CardDescription>保存后同步更新 profile.current_weight_kg。</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
              <Input type="date" value={form.date} onChange={(e) => patch({ date: e.target.value })} required />
              <Input type="number" step="0.1" min="1" placeholder="体重 kg" value={form.weight_kg} onChange={(e) => patch({ weight_kg: e.target.value })} required />
              <Input type="number" step="0.1" min="0" max="24" placeholder="睡眠 h" value={form.sleep_hours} onChange={(e) => patch({ sleep_hours: e.target.value, recovery_score: "" })} />
              <Input type="number" min="1" max="5" placeholder="疲劳 1-5" value={form.fatigue_level} onChange={(e) => patch({ fatigue_level: e.target.value, recovery_score: "" })} />
              <Input placeholder="疼痛部位" value={form.pain_area} onChange={(e) => patch({ pain_area: e.target.value })} />
              <Input type="number" min="0" max="10" placeholder="疼痛 0-10" value={form.pain_score} onChange={(e) => patch({ pain_score: e.target.value, recovery_score: "" })} />
              <Input type="number" min="1" placeholder="静息心率" value={form.resting_hr} onChange={(e) => patch({ resting_hr: e.target.value })} />
              <Input type="number" min="0" max="100" placeholder="恢复评分" value={form.recovery_score} onChange={(e) => patch({ recovery_score: e.target.value })} />
              <Textarea className="sm:col-span-2" placeholder="AI 恢复建议" value={form.ai_recovery_advice} onChange={(e) => patch({ ai_recovery_advice: e.target.value })} />
              <Textarea className="sm:col-span-2" placeholder="备注" value={form.notes} onChange={(e) => patch({ notes: e.target.value })} />
              <Button className="sm:col-span-4" type="submit"><Save className="mr-2 h-4 w-4" />保存恢复记录</Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="体重趋势" data={chartData} dataKey="weight" unit="kg" />
          <ChartCard title="睡眠趋势" data={chartData} dataKey="sleep" unit="h" />
          <ChartCard title="疲劳趋势" data={chartData} dataKey="fatigue" unit="级" />
          <ChartCard title="疼痛趋势" data={chartData} dataKey="pain" unit="分" />
        </div>

        <div className="grid gap-3">
          {metrics.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><Badge tone={(item.pain_score ?? 0) >= 6 ? "red" : (item.fatigue_level ?? 0) >= 4 ? "orange" : "green"}>{item.date}</Badge><strong>{item.weight_kg} kg</strong><span>睡眠 {item.sleep_hours ?? "—"}h</span><span>疲劳 {item.fatigue_level ?? "—"}</span></div>
                  <p className="mt-1 text-sm text-muted-foreground">疼痛：{item.pain_area || "无"} {item.pain_score ?? 0}/10；{item.notes || item.ai_recovery_advice || "暂无备注"}</p>
                </div>
                <div className="text-sm font-medium">恢复 {item.recovery_score ?? "—"}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function ChartCard({ title, data, dataKey, unit }: { title: string; data: any[]; dataKey: string; unit: string }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle><CardDescription>单位：{unit}</CardDescription></CardHeader>
      <CardContent className="h-72">
        {data.length === 0 ? <div className="p-6 text-sm text-muted-foreground">暂无数据。</div> : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey={dataKey} /></LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}
