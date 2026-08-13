// /api/v1/me/menus — M09.F03.I04
//
// TypeSpec: tsp/routes/me.tsp getMyMenus(): Record<EffectiveMenuNode[]>
// 当前用户的有效菜单（按 app 分组，返回 appCode → 树形菜单）
//
// Phase 5 简化：返回当前 tenant 的所有 active menus（按 appId 分组到 appCode）
// 不做完整 role → menu 的 JOIN 计算（Phase 6 接 role_menu_grants 后做）

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { menus, apps } from "@/db/schema";
import { claimsFromAuthHeader, verifyPathTenant } from "@/lib/tenant-guard";

type EffectiveMenuNode = {
  id: string;
  appId: string;
  parentId?: string;
  code: string;
  name: string;
  path?: string;
  icon?: string;
  type: string;
  sortOrder: number;
  children: EffectiveMenuNode[];
};

function toEffectiveMenuNode(m: typeof menus.$inferSelect): EffectiveMenuNode {
  return {
    id: m.id,
    appId: m.appId,
    parentId: m.parentId ?? undefined,
    code: m.code,
    name: m.name,
    path: m.path ?? undefined,
    icon: m.icon ?? undefined,
    type: m.type,
    sortOrder: m.sortOrder,
    children: [] as ReturnType<typeof toEffectiveMenuNode>[],
  };
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 用 path-agnostic tenant-guard（JWT 需含 tenant_id claim）
  const claims = verifyPathTenant(null, req.headers.get("authorization"));
  if (!claims.tenant_id) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "JWT missing tenant_id; need /me/tenants/:id/switch first" },
      { status: 400 },
    );
  }
  const tenantId = claims.tenant_id;

  // Phase 5 占位：返回 tenant 所有 active menus（按 app 分组）
  // Phase 6 加 role_menu_grants JOIN 后改为「按 user role 过滤」
  const rows = await db
    .select({
      menu: menus,
      appCode: apps.code,
    })
    .from(menus)
    .innerJoin(apps, eq(menus.appId, apps.id))
    .where(eq(menus.status, "active"))
    .orderBy(apps.code, menus.sortOrder);

  const grouped: Record<string, ReturnType<typeof toEffectiveMenuNode>[]> = {};
  for (const r of rows) {
    const code = r.appCode;
    if (!grouped[code]) grouped[code] = [];
    grouped[code]!.push(toEffectiveMenuNode(r.menu));
  }
  return NextResponse.json(grouped);
}