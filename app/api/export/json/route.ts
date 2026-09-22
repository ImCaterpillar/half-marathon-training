import { NextRequest, NextResponse } from "next/server";
import { withApiAuth } from "@/lib/auth/api-auth";
import { exportFullBackup } from "@/lib/services/backup";

export const GET = withApiAuth(async (_request: NextRequest) => {
  const data = await exportFullBackup();
  return new NextResponse(JSON.stringify(data, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="half-marathon-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
});
