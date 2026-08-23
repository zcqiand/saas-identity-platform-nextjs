// /api/v1/apps/[code] - M04.F01 公共读侧：按 appCode 返回应用公开信息
//
// TypeSpec: tsp/routes/apps.tsp
//   getApp(@path code): AppPublicInfo
// 免鉴权（接入方侧边栏/标题要显示应用名，不能强制管理员 JWT）；
// 只返回展示字段（id/code/name/description/icon/status），不暴露 OAuth 字段。
//
// v0.7.38 接 DB（此前 demo 模式读烘进镜像的 seed JSON，"Phase 6 接 DB" 欠账）。

import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const rows = await db
    .select({
      id: apps.id,
      code: apps.code,
      name: apps.name,
      description: apps.description,
      icon: apps.icon,
      status: apps.status,
    })
    .from(apps)
    .where(and(eq(apps.code, code), eq(apps.status, "active")))
    .limit(1);
  const app = rows[0];
  if (!app) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: `App '${code}' not found` },
      { status: 404 },
    );
  }
  return NextResponse.json(app);
}
