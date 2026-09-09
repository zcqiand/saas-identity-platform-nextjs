// /api/v1/apps/[code] - M04.F01 公共读侧：按 appCode 返回应用公开信息
//
// TypeSpec: tsp/routes/apps.tsp
//   getApp(@path code): AppPublicInfo
// 免鉴权（接入方侧边栏/标题要显示应用名，不能强制管理员 JWT）；
// 只返回展示字段（id/clientId/clientName/status），不暴露 OAuth 字段。
//
// 2026-09-09 schema pivot：apps → oauthClient。

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthClient } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const rows = await db
    .select({
      id: oauthClient.id,
      clientId: oauthClient.clientId,
      clientName: oauthClient.clientName,
      status: oauthClient.status,
    })
    .from(oauthClient)
    .where(and(eq(oauthClient.clientId, code), eq(oauthClient.status, 1)))
    .limit(1);
  const app = rows[0];
  if (!app) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: `App '${code}' not found` },
      { status: 404 },
    );
  }
  return NextResponse.json({
    id: app.id,
    clientId: app.clientId,
    name: app.clientName,
    status: "active",
  });
}
