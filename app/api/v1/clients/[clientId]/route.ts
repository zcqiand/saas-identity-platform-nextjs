// /api/v1/clients/[code] - M04.F01 公共读侧：按 clientCode 返回应用公开信息
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
  { params }: { params: Promise<{ clientId: string }> },
) {
  const { clientId } = await params;
  const rows = await db
    .select({
      clientId: oauthClient.clientId,
      clientName: oauthClient.clientName,
      status: oauthClient.status,
    })
    .from(oauthClient)
    .where(and(eq(oauthClient.clientId, clientId), eq(oauthClient.status, 1)))
    .limit(1);
  const app = rows[0];
  if (!app) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: `App '${clientId}' not found` },
      { status: 404 },
    );
  }
  // 2026-09-12 SSOT 对齐：返 OAuthClientPublicInfo {clientId, clientName, status:int32}
  // （msw oracle handlers-extra.ts:1278 同构；status 是 smallint 原样透传，非 "active" 字符串）
  return NextResponse.json({
    clientId: app.clientId,
    clientName: app.clientName,
    status: app.status,
  });
}
