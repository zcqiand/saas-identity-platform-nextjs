// /api/v1/me/menus?appCode=<code> - M09.F03.I04
//
// TypeSpec: getMyMenus(appCode): EffectiveMenuNode[]
// 返回当前用户在指定 appCode 下的有效菜单（树形）。
//
// v0.7.38 接 DB（此前 demo 模式读烘进镜像的 seed JSON，"Phase 6 接 DB" 欠账；
// 也修掉写死 acme admin 的 RBAC 假设）：
//   1. JWT 必填（401）-> claims.sub = users.id
//   2. tenant_memberships 拉用户全部 roleIds（status != removed）
//   3. role_menu_grants 按 roleId IN (...) 聚合 allowed menuIds
//   4. apps 按 code/UUID 解析 -> menus 建树：一级节点始终可见，子节点须在
//      授权集内（与旧 seed 版语义一致）
// 跨仓 lab-nextjs 反代时 CORS + 跨实例都通过这层 Route Handler。

import { NextRequest, NextResponse } from "next/server";
import { and, eq, ne, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { apps, menus, tenantMemberships, roleMenuGrants } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";
import { resolveAppId } from "@/lib/app-resolver";

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

    const url = new URL(req.url);
    const appCode = url.searchParams.get("appCode");
    if (!appCode) {
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "appCode query parameter is required",
        },
        { status: 400 },
      );
    }
    if (!claims.sub) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "JWT missing sub claim" },
        { status: 401 },
      );
    }

    // 1. app（code 或 UUID 均可，与 admin 路由同款 resolver；校验 active）
    const appId = await resolveAppId(appCode);
    if (!appId) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: `App '${appCode}' not found` },
        { status: 404 },
      );
    }
    const appRows = await db
      .select({ id: apps.id })
      .from(apps)
      .where(and(eq(apps.id, appId), eq(apps.status, "active")))
      .limit(1);
    if (appRows.length === 0) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: `App '${appCode}' not active` },
        { status: 404 },
      );
    }

    // 2. 用户全部角色（跨租户聚合，与 /me 的 memberships 视角一致）
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

    // 3. 角色的菜单授权集
    const allowed = new Set<string>();
    if (roleIds.length > 0) {
      const grants = await db
        .select({ menuIds: roleMenuGrants.menuIds })
        .from(roleMenuGrants)
        .where(inArray(roleMenuGrants.roleId, roleIds));
      for (const g of grants) for (const id of g.menuIds) allowed.add(id);
    }

    // 4. 该 app 的全部 active 菜单（一次取回，内存建树）
    const rows = await db
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
      })
      .from(menus)
      .where(and(eq(menus.appId, appId), eq(menus.status, "active")))
      .orderBy(asc(menus.sortOrder), asc(menus.code));

    // 建树：一级节点始终可见，子节点须在授权集内（旧 seed 版同语义）
    const byParent = new Map<string | null, MenuRow[]>();
    for (const m of rows) {
      const key = m.parentId ?? null;
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key)!.push(m);
    }
    const build = (parentId: string | null): EffectiveMenuNode[] =>
      (byParent.get(parentId) ?? [])
        .filter((m) => parentId === null || allowed.has(m.id))
        .map((m) => ({ ...m, children: build(m.id) }));

    return NextResponse.json({ [appCode]: build(null) });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
