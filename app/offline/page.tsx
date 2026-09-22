import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OfflinePage() {
  return (
    <AppShell>
      <Card>
        <CardHeader><CardTitle>当前离线</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>页面壳和最近 7 天训练计划可离线查看；打卡会保存为 pending_logs，网络恢复后由底部提示同步到云端数据库。</p>
          <Button asChild><Link href="/week">查看缓存周计划</Link></Button>
        </CardContent>
      </Card>
    </AppShell>
  );
}
