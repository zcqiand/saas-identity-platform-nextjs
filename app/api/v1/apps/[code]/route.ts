// /api/v1/apps/[code] - M04.F01 公共读侧：按 appCode 返回应用公开信息
//
// TypeSpec: tsp/routes/apps.tsp
//   getApp(@path code): AppPublicInfo
// 免鉴权（接入方侧边栏/标题要显示应用名，不能强制管理员 JWT）；
// 只返回展示字段（id/code/name/description/icon/status），不暴露 OAuth 字段。
//
// demo 模式：与 /api/v1/me/menus 同款，直接读 saas-msw 的 JSON fixtures。
// Phase 6 接 DB 后换成 drizzle 查询 apps 表的公开列。

import { NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type App = {
  id: string;
  code: string;
  name: string;
  description?: string;
  icon?: string;
  status: string;
};

// 与 /api/v1/me/menus 同款跨仓读：SEEDS_DIR = saas-msw/src/seeds/
const SEEDS_DIR = resolve(process.cwd(), "../saas-identity-platform-msw/src/seeds");

// 加 fallback：cwd 路径不通时切 node_modules/...
function loadApps(): App[] {
  try {
    return JSON.parse(readFileSync(resolve(SEEDS_DIR, "apps.json"), "utf8")) as App[];
  } catch {
    const FALLBACK_DIR = resolve(
      process.cwd(),
      "node_modules/@saas/identity-platform-msw/src/seeds",
    );
    return JSON.parse(readFileSync(resolve(FALLBACK_DIR, "apps.json"), "utf8")) as App[];
  }
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const app = loadApps().find((a) => a.code === code && a.status === "active");
  if (!app) {
    return NextResponse.json(
      { code: "NOT_FOUND", message: `App '${code}' not found` },
      { status: 404 },
    );
  }
  const { id, name, description, icon, status } = app;
  return NextResponse.json({ id, code, name, description, icon, status });
}
