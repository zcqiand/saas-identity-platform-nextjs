// /api/v1/me/menus - M09.F03.I04 (2026-08-30 字节对齐 contract-test I05)
//
// TypeSpec: getMyMenus(): Record<appCode, EffectiveMenuNode[]>
// 返回**所有 active app** 当前用户可见菜单(按 appCode 分组), 无 query 参数。
// 此前 v0.7.38 加了 ?appCode= 强制 —— 与 OpenAPI 不符, 也让 msw/aspnetcore/springboot
// 走同一 path 时签名不同. 现改返全 map, 与 msw/contract-test 对齐.
//
// 1. JWT 必填 (401) -> claims.sub = users.id
// 2. tenant_memberships 拉用户全部 roleIds (status != removed)
// 3. role_menu_grants 按 roleId IN (...) 聚合 allowed menuIds
// 4. 遍历所有 active apps, 每个 app 建树: 一级节点始终可见, 子节点须在授权集内

import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { apps, menus, tenantMemberships, roleMenuGrants } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

type MenuRow = {
  id: string;
  appId: string;
  parentId: string | null;
  code: string;
  name: string;
  path: string | null;
  icon: string | null;
  type: string;
  sortOrder: number;
};

type EffectiveMenuNode = MenuRow & { children: EffectiveMenuNode[] };

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const claims = await verifyPathTenant(null, req.headers.get("authorization"));
    if (!claims.sub) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "JWT missing sub claim" },
        { status: 401 },
      );
    }

    // 1. 用户全部角色(跨租户聚合)
    const memberships = await db
      .select({ roleIds: tenantMemberships.roleIds })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.userId, claims.sub),
          ne(tenantMemberships.status, "removed"),
        ),
      );
    const roleIds = Array.from(new Set(memberships.flatMap((m) => m.roleIds)));

    // 2. 角色的菜单授权集
    const allowed = new Set<string>();
    if (roleIds.length > 0) {
      const grants = await db
        .select({ menuIds: roleMenuGrants.menuIds })
        .from(roleMenuGrants)
        .where(inArray(roleMenuGrants.roleId, roleIds));
      for (const g of grants) for (const id of g.menuIds) allowed.add(id);
    }

    // 3. 所有 active apps 一次拉回
    const activeApps = await db
      .select({ id: apps.id, code: apps.code })
      .from(apps)
      .where(eq(apps.status, "active"));

    // 4. 全部 active apps 的所有菜单(内存按 appId 分组建树)
    const allRows = await db
      .select({
        id: menus.id,
        appId: menus.appId,
        parentId: menus.parentId,
        code: menus.code,
        name: menus.name,
        path: menus.path,
        icon: menus.icon,
        type: menus.type,
        sortOrder: menus.sortOrder,
        // 不带 status/createdAt/updatedAt — 与 msw/contract-test 字段集对齐
      })
      .from(menus)
      .where(eq(menus.status, "active"))
      .orderBy(asc(menus.sortOrder), asc(menus.code));

    const result: Record<string, EffectiveMenuNode[]> = {};
    for (const app of activeApps) {
      const byParent = new Map<string | null, MenuRow[]>();
      for (const m of allRows) {
        if (m.appId !== app.id) continue;
        const key = m.parentId ?? null;
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push(m);
      }
      const build = (parentId: string | null): EffectiveMenuNode[] =>
        (byParent.get(parentId) ?? [])
          .filter((m) => parentId === null || allowed.has(m.id))
          .map((m) => ({ ...m, children: build(m.id) }));
      // 2026-09-01 contract-test I05：响应只含「该 app 下至少有一条 grant 内菜单的 app」。
      // 否则 build(null) 对无 grant 的 app 返 [] 也照样塞 key，与真后端不一致。
      // 对齐 aspnetcore/springboot（实际 PG 状态）和 msw handler。
      if (allowed.size > 0 && allRows.some((m) => m.appId === app.id && allowed.has(m.id))) {
        result[app.code] = build(null);
      }
    }
    return NextResponse.json(result);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}