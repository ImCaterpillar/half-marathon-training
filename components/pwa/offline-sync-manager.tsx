"use client";

import { useEffect, useState } from "react";
import { CloudUpload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { listPendingWorkoutLogs, removePendingWorkoutLog, type PendingWorkoutLog } from "@/lib/browser/offline-store";

type Conflict = {
  localId: string;
  workoutId: string;
  workoutTitle: string;
  workoutDate: string;
  cloudLog: unknown;
  pendingPayload: Record<string, unknown>;
};

export function OfflineSyncManager() {
  const [pending, setPending] = useState<PendingWorkoutLog[]>([]);
  const [conflicts, setConflicts] = useState<Conflict[]>([]);
  const [message, setMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [online, setOnline] = useState(true);

  async function refresh() {
    try {
      setPending(await listPendingWorkoutLogs());
    } catch {
      setPending([]);
    }
  }

  useEffect(() => {
    setOnline(navigator.onLine);
    refresh();
    const onChanged = () => refresh();
    const onOnline = () => { setOnline(true); refresh(); };
    const onOffline = () => setOnline(false);
    window.addEventListener("pending-logs-changed", onChanged);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("pending-logs-changed", onChanged);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  async function sync() {
    if (pending.length === 0 || !online) return;
    setSyncing(true);
    setMessage("");
    try {
      const response = await fetch("/api/offline/sync-pending-logs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ logs: pending }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json?.error?.message ?? "同步失败");
      for (const localId of json.data.synced_local_ids ?? []) await removePendingWorkoutLog(localId);
      setConflicts(json.data.conflicts ?? []);
      setMessage(json.data.conflicts?.length ? "部分离线打卡与云端冲突，请选择处理方式。" : "离线打卡已同步到云端数据库。");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "同步失败");
    } finally {
      setSyncing(false);
    }
  }

  async function resolveConflict(conflict: Conflict, mode: "keep_cloud" | "overwrite_cloud" | "merge_notes") {
    setSyncing(true);
    try {
      const response = await fetch("/api/offline/resolve-conflict", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...conflict, payload: conflict.pendingPayload, mode }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json?.error?.message ?? "处理冲突失败");
      await removePendingWorkoutLog(conflict.localId);
      setConflicts((items) => items.filter((item) => item.localId !== conflict.localId));
      setMessage("冲突已处理。");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "处理冲突失败");
    } finally {
      setSyncing(false);
    }
  }

  if (pending.length === 0 && conflicts.length === 0 && !message) return null;

  return (
    <div className="fixed bottom-20 left-3 right-3 z-40 mx-auto max-w-xl space-y-2 lg:bottom-6 lg:left-auto lg:right-6 lg:w-[28rem]">
      {pending.length > 0 ? (
        <Card className="border-primary/40 bg-background/95 backdrop-blur">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base">有 {pending.length} 条未同步打卡</CardTitle>
                <CardDescription>网络恢复后可写入云端数据库；若云端已有打卡会进入冲突处理。</CardDescription>
              </div>
              <button className="text-muted-foreground" onClick={() => setMessage("")} aria-label="关闭提示"><X className="h-4 w-4" /></button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 pt-0">
            <Button onClick={sync} disabled={syncing || !online}><CloudUpload className="mr-2 h-4 w-4" />{syncing ? "同步中..." : "同步 pending_logs"}</Button>
            <Button variant="outline" onClick={refresh}>刷新</Button>
          </CardContent>
        </Card>
      ) : null}

      {message ? <Card><CardContent className="p-3 text-sm text-muted-foreground">{message}</CardContent></Card> : null}

      {conflicts.map((conflict) => (
        <Card key={conflict.localId} className="border-orange-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">云端已有打卡：{conflict.workoutTitle}</CardTitle>
            <CardDescription>{conflict.workoutDate}，请选择保留云端、覆盖云端或合并备注。</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-3 pt-0">
            <Button variant="outline" disabled={syncing} onClick={() => resolveConflict(conflict, "keep_cloud")}>保留云端</Button>
            <Button disabled={syncing} onClick={() => resolveConflict(conflict, "overwrite_cloud")}>覆盖云端</Button>
            <Button variant="outline" disabled={syncing} onClick={() => resolveConflict(conflict, "merge_notes")}>合并备注</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
