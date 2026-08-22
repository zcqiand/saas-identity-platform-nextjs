// /api/v1/apps/[code] - M04.F01 公共读侧：按 appCode 返回应用公开信息
//
// TypeSpec: tsp/routes/apps.tsp
//   getApp(@path code): AppPublicInfo
// 免鉴权（接入方侧边栏/标题要显示应用名，不能强制管理员 JWT）；
// 只返回展示字段（id/code/name/description/icon/status），不暴露 OAuth 字段。
//
// demo 模式：读 seed JSON（src/lib/demo-seeds.ts，ADR-0012 运行时 import 清零
// 后不再 JS import saas-msw 包）。Phase 6 接 DB 后换成 drizzle 查询 apps 表的公开列。

import { NextResponse } from "next/server";
import { loadSeedJson } from "@/lib/demo-seeds";

type App = {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  status: string;
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const apps = loadSeedJson<App[]>("apps.json");
  const app = apps.find((a) => a.code === code && a.status === "active");
  if (!app) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: `App '${code}' not found` },
      { status: 404 },
    );
  }
  const { id, name, description, icon, status } = app;
  return NextResponse.json({ id, code, name, description, icon, status });
}
