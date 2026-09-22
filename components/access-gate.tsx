"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type AccessState = "checking" | "allowed" | "blocked";

export function AccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AccessState>("checking");
  const [accessCode, setAccessCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/access/status", { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (cancelled) return;
        setState(json?.data?.authenticated ? "allowed" : "blocked");
      })
      .catch(() => {
        if (!cancelled) {
          setMessage("无法检查访问状态，请确认网络连接。");
          setState("blocked");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const response = await fetch("/api/access/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ accessCode }),
      });
      const json = await response.json();
      if (!response.ok || !json.success) {
        setMessage(json?.error?.message ?? "访问码验证失败");
        return;
      }
      setState("allowed");
      setAccessCode("");
    } catch {
      setMessage("网络错误，请稍后重试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (state === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">正在检查访问状态...</p>
      </main>
    );
  }

  if (state === "allowed") return <>{children}</>;

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>请输入访问码</CardTitle>
          <CardDescription>这是单用户个人训练系统，验证后 30 天内免重复输入。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Input
              autoFocus
              type="password"
              value={accessCode}
              onChange={(event) => setAccessCode(event.target.value)}
              placeholder="访问码"
              minLength={1}
            />
            {message ? <p className="text-sm text-destructive">{message}</p> : null}
            <Button className="w-full" type="submit" disabled={submitting || accessCode.length === 0}>
              {submitting ? "验证中..." : "进入系统"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
