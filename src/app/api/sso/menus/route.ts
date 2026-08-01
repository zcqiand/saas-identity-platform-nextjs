/**
 * M03.F02.I04 - GET /api/sso/menus
 *
 * lab 仓的 (protected)/layout.tsx 调此端点拉侧边栏菜单。
 *
 * 与 saas 自家 admin /api/menus（numeric id，服务于 saas 后台）的差异：
 *   - 本路由返回 string id 的菜单（与 saas-React 仓 msw 契约对齐，lab 端好对接）
 *   - 不需要 Bearer（mock 阶段 lab 仓已把 permissions 写入 lab_session，无需再验 saas token）
 *     生产可加 Bearer 校验
 *
 * Query：appId（必填，本路由仅支持 app-lab）
 *
 * 不按 enabled 过滤：enabled=false 的菜单项（lab-nextjs 路由未实现）也返回给 lab，
 * lab 端 sidebar 据此挂「规划」徽标 —— 行为对齐 lab-React REF（GroupSection 渲染
 * built=false 项带「规划」badge）。
 */
import { NextResponse } from "next/server";
import { LAB_MENUS, APP_LAB_ID } from "@/lib/lab-seed";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const appId = url.searchParams.get("appId") ?? "";

  if (appId !== APP_LAB_ID) {
    return NextResponse.json({ message: "appId 必填且仅支持 app-lab" }, { status: 400 });
  }

  const items = LAB_MENUS.filter((m) => m.appId === appId).map((m) => ({
    id: m.id,
    name: m.name,
    path: m.path,
    appId: m.appId,
    parentId: m.parentId,
    sort: m.sort,
    enabled: m.enabled,
    ...(m.permission ? { permission: m.permission } : {}),
  }));

  return NextResponse.json(items);
}
