"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Bot, CalendarDays, ClipboardList, Gauge, Home, Settings, Target, UserRound } from "lucide-react";
import { AccessGate } from "@/components/access-gate";
import { OfflineSyncManager } from "@/components/pwa/offline-sync-manager";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { cn } from "@/lib/utils/cn";

const desktopNav = [
  ["/dashboard", "仪表盘", Home],
  ["/plan", "年度计划", ClipboardList],
  ["/week", "周计划", Activity],
  ["/calendar", "日历", CalendarDays],
  ["/stats", "数据统计", BarChart3],
  ["/tests", "测试成绩", Gauge],
  ["/body", "体重恢复", UserRound],
  ["/goal", "目标页", Target],
  ["/ai-coach", "AI 教练", Bot],
  ["/versions", "版本管理", ClipboardList],
  ["/settings", "设置", Settings],
] as const;

const mobileNav = [
  ["/dashboard", "首页", Home],
  ["/week", "计划", Activity],
  ["/calendar", "日历", CalendarDays],
  ["/stats", "统计", BarChart3],
  ["/settings", "我的", UserRound],
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AccessGate>
      <PwaProvider />
      <div className="min-h-screen bg-muted/30">
        <aside className="fixed left-0 top-0 hidden h-screen w-64 overflow-y-auto border-r bg-background p-5 lg:block">
          <div className="text-lg font-bold leading-tight">半马训练系统</div>
          <p className="mt-1 text-xs text-muted-foreground">Checkpoint 5 移动端与 PWA</p>
          <nav className="mt-8 grid gap-1">
            {desktopNav.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                aria-current={pathname === href ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted",
                  pathname === href ? "bg-primary text-primary-foreground hover:bg-primary/90" : "text-foreground/80",
                )}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="mx-auto w-full max-w-6xl px-3 pb-28 pt-4 sm:px-4 lg:ml-64 lg:px-8 lg:pb-8">{children}</main>
        <nav className="safe-bottom fixed bottom-0 left-0 right-0 grid grid-cols-5 border-t bg-background/95 p-2 backdrop-blur lg:hidden">
          {mobileNav.map(([href, label, Icon]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname === href ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg px-2 py-2 text-center text-[11px] font-medium transition-colors hover:bg-muted",
                pathname === href ? "bg-primary/10 text-primary" : "text-foreground/70",
              )}
            >
              <Icon className="mb-1 h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        <OfflineSyncManager />
      </div>
    </AccessGate>
  );
}
