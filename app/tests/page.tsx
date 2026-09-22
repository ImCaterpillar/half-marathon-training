"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Line, LineChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { RotateCcw, Save } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatDuration, formatPace, secondsToGoalGapText } from "@/lib/format";

const goalSeconds = 4890;
const goalPaceSeconds = 232;

function parseTimeToSeconds(text: string) {
  const parts = text.split(":").map((part) => Number(part));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

function predictHalf(distanceKm: number, seconds: number) {
  if (!distanceKm || !seconds) return null;
  return Math.round(seconds * Math.pow(21.0975 / distanceKm, 1.06));
}

function todayChina() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "2026";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

const defaultForm = {
  test_date: todayChina(),
  test_type: "5km",
  distance_km: "5",
  result_time_text: "",
  result_time_seconds: "",
  avg_pace_text: "",
  avg_pace_seconds_per_km: "",
  weather: "",
  route: "",
  feeling: "",
  predicted_half_marathon_seconds: "",
  predicted_half_marathon_text: "",
  ai_analysis: "",
  notes: "",
};

type TestResult = any;

export default function TestsPage() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/tests", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json?.error?.message ?? "读取测试成绩失败");
      setTests(json.data.tests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function autoCalc(next: typeof form) {
    const seconds = Number(next.result_time_seconds || parseTimeToSeconds(next.result_time_text));
    const distance = Number(next.distance_km);
    const pace = distance > 0 && seconds > 0 ? Math.round(seconds / distance) : 0;
    const predicted = predictHalf(distance, seconds);
    return {
      ...next,
      result_time_seconds: seconds ? String(seconds) : "",
      avg_pace_seconds_per_km: pace ? String(pace) : "",
      avg_pace_text: pace ? formatPace(pace) : "",
      predicted_half_marathon_seconds: predicted ? String(predicted) : "",
      predicted_half_marathon_text: predicted ? formatDuration(predicted) : "",
    };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage("");
    setError("");
    try {
      const payload = autoCalc(form);
      const response = await fetch("/api/tests", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json?.error?.message ?? "保存失败");
      setMessage("测试成绩已保存");
      setForm(defaultForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    }
  }

  const chartData = useMemo(() => [...tests].reverse().map((item) => ({ date: item.test_date, predicted: item.predicted_half_marathon_seconds ? Math.round(item.predicted_half_marathon_seconds / 60) : null, pace: item.avg_pace_seconds_per_km })), [tests]);
  const latest = tests[0];

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">阶段测试</h1>
            <p className="mt-1 text-sm text-muted-foreground">支持 3km、5km、10km、15km、半马测试，数据写入 test_results。</p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}><RotateCcw className="mr-2 h-4 w-4" />刷新</Button>
        </header>

        {message ? <Card><CardContent className="p-4 text-sm text-green-700">{message}</CardContent></Card> : null}
        {error ? <Card><CardContent className="p-4 text-sm text-destructive">{error}</CardContent></Card> : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <Card>
            <CardHeader><CardDescription>当前最新预测</CardDescription><CardTitle>{latest?.predicted_half_marathon_text ?? "暂无"}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">与 1:21:30 差距：{secondsToGoalGapText(latest?.predicted_half_marathon_seconds, goalSeconds)}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardDescription>目标配速</CardDescription><CardTitle>3&apos;52&quot;/km</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">最新测试均配：{latest ? formatPace(latest.avg_pace_seconds_per_km) : "暂无"}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardDescription>阶段门槛判断</CardDescription><CardTitle>{latest && latest.avg_pace_seconds_per_km <= goalPaceSeconds + 60 ? "接近门槛" : "继续基础建设"}</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">门槛判断基于测试配速与阶段目标，AI 分析字段可手动记录。</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader><CardTitle>新增测试成绩</CardTitle><CardDescription>填写成绩后会自动计算均配和半马预测。</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-4">
              <Input type="date" value={form.test_date} onChange={(e) => setForm({ ...form, test_date: e.target.value })} required />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.test_type} onChange={(e) => setForm({ ...form, test_type: e.target.value, distance_km: e.target.value === "半马" ? "21.0975" : e.target.value.replace("km", "") })}>
                {["3km", "5km", "10km", "15km", "半马"].map((type) => <option key={type}>{type}</option>)}
              </select>
              <Input type="number" step="0.001" min="0.1" placeholder="距离 km" value={form.distance_km} onChange={(e) => setForm({ ...form, distance_km: e.target.value })} required />
              <Input placeholder="成绩，如 24:30 或 1:42:36" value={form.result_time_text} onChange={(e) => setForm(autoCalc({ ...form, result_time_text: e.target.value }))} required />
              <Input placeholder="天气" value={form.weather} onChange={(e) => setForm({ ...form, weather: e.target.value })} />
              <Input placeholder="路线" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })} />
              <Input readOnly value={form.avg_pace_text} placeholder="自动均配" />
              <Input readOnly value={form.predicted_half_marathon_text} placeholder="自动半马预测" />
              <Textarea className="sm:col-span-2" placeholder="主观感受" value={form.feeling} onChange={(e) => setForm({ ...form, feeling: e.target.value })} />
              <Textarea className="sm:col-span-2" placeholder="AI 分析 / 备注" value={form.ai_analysis} onChange={(e) => setForm({ ...form, ai_analysis: e.target.value })} />
              <Button className="sm:col-span-4" type="submit"><Save className="mr-2 h-4 w-4" />保存测试成绩</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>半马预测趋势</CardTitle><CardDescription>来自 test_results，不使用写死数据。</CardDescription></CardHeader>
          <CardContent className="h-72">
            {chartData.length === 0 ? <div className="p-6 text-sm text-muted-foreground">暂无测试数据。</div> : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Line type="monotone" dataKey="predicted" name="半马预测 分钟" /></LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <div className="grid gap-3">
          {tests.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2"><Badge tone="secondary">{item.test_type}</Badge><strong>{item.test_date}</strong><span>{item.result_time_text}</span></div>
                  <p className="mt-1 text-sm text-muted-foreground">均配 {formatPace(item.avg_pace_seconds_per_km)}；半马预测 {item.predicted_half_marathon_text ?? "暂无"}；{item.feeling || item.notes || "暂无备注"}</p>
                </div>
                <div className="text-sm text-muted-foreground">距目标：{secondsToGoalGapText(item.predicted_half_marathon_seconds, goalSeconds)}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
