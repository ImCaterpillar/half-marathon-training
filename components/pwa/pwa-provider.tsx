"use client";

import { useEffect, useState } from "react";
import { Download, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function PwaProvider() {
  const [online, setOnline] = useState(true);
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const handleBeforeInstall = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(() => setRegistered(true)).catch(() => setRegistered(false));
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  async function install() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    await deferredPrompt.userChoice.catch(() => undefined);
    setDeferredPrompt(null);
  }

  return (
    <div className="pointer-events-none fixed left-3 right-3 top-3 z-50 mx-auto max-w-lg space-y-2 lg:left-auto lg:right-6 lg:top-6 lg:w-96">
      {!online ? (
        <Card className="pointer-events-auto border-orange-300 bg-orange-50 text-orange-900 dark:bg-orange-950 dark:text-orange-100">
          <CardContent className="flex items-center gap-2 p-3 text-sm"><WifiOff className="h-4 w-4" />当前离线：可查看缓存计划，打卡会保存到 pending_logs。</CardContent>
        </Card>
      ) : null}
      {deferredPrompt && registered ? (
        <Card className="pointer-events-auto">
          <CardContent className="flex items-center justify-between gap-3 p-3 text-sm">
            <span>可添加到手机桌面。</span>
            <Button size="sm" onClick={install}><Download className="mr-1 h-4 w-4" />安装</Button>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
