// /api/v1/me/menus - M04.F04.I08 (2026-08-30 字节对齐 contract-test I05)
//
// TypeSpec: getMyMenus(): Record<appCode, EffectiveMenuNode[]>
// 返回**所有 active app** 当前用户可见菜单(按 appCode 分组), 无 query 参数。
//
// 2026-09-09 schema pivot：
// - apps → oauthClient (无 code 列；code 是 clientId 的语义键)
//
// 流程：
// 1. JWT 必填 (401) -> claims.sub = sys_user.id
// 2. tenant_member 拉用户所有 active membership
// 3. tenant_member_role → sys_role → sys_role_menu → menuIds
// 4. 遍历所有 active oauthClient，每个 client 建树: 一级节点始终可见, 子节点须在授权集内

import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { oauthClient, sysMenu, tenantMember, tenantMemberRole, sysRole, sysRoleMenu } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

type MenuRow = {
  id: string;
  clientId: string;
  parentId: string | null;
  title: string;
  type: number;
  path: string | null;
  icon: string | null;
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

    // 1. 用户所有 active membership
    const memberships = await db
      .select({ memberId: tenantMember.id })
      .from(tenantMember)
      .where(and(eq(tenantMember.userId, claims.sub), eq(tenantMember.status, 1)));
    const memberIds = memberships.map((m) => m.memberId);

    // 2. membership → role → menu
    const allowed = new Set<string>();
    if (memberIds.length > 0) {
      const memberRoles = await db
        .select({ roleId: tenantMemberRole.roleId })
        .from(tenantMemberRole)
        .where(inArray(tenantMemberRole.memberId, memberIds));
      const roleIds = Array.from(new Set(memberRoles.map((r) => r.roleId)));
      if (roleIds.length > 0) {
        const grants = await db
          .select({ menuId: sysRoleMenu.menuId })
          .from(sysRoleMenu)
          .where(inArray(sysRoleMenu.roleId, roleIds));
        for (const g of grants) allowed.add(g.menuId);
      }
    }

    // 3. 所有 active oauthClient（status=1）
    const activeClients = await db
      .select({ id: oauthClient.id, clientId: oauthClient.clientId })
      .from(oauthClient)
      .where(eq(oauthClient.status, 1));

    // 4. 全部 active sysMenu（status=1）
    const allRows = await db
      .select({
        id: sysMenu.id,
        clientId: sysMenu.clientId,
        parentId: sysMenu.parentId,
        title: sysMenu.title,
        type: sysMenu.type,
        path: sysMenu.path,
        icon: sysMenu.icon,
        sortOrder: sysMenu.sortOrder,
      })
      .from(sysMenu)
      .where(eq(sysMenu.status, 1))
      .orderBy(asc(sysMenu.sortOrder), asc(sysMenu.title));

    const result: Record<string, EffectiveMenuNode[]> = {};
    for (const c of activeClients) {
      const byParent = new Map<string | null, MenuRow[]>();
      for (const m of allRows) {
        if (m.clientId !== c.clientId) continue;
        const key = m.parentId ?? null;
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push({
          id: m.id,
          clientId: m.clientId,
          parentId: m.parentId ?? null,
          title: m.title,
          type: m.type,
          path: m.path ?? null,
          icon: m.icon ?? null,
          sortOrder: m.sortOrder,
        });
      }
      const build = (parentId: string | null): EffectiveMenuNode[] =>
        (byParent.get(parentId) ?? [])
          .filter((m) => parentId === null || allowed.has(m.id))
          .map((m) => ({ ...m, children: build(m.id) }));
      if (
        allowed.size > 0 &&
        allRows.some((m) => m.clientId === c.clientId && allowed.has(m.id))
      ) {
        result[c.clientId] = build(null);
      }
    }
    return NextResponse.json(result);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

// Suppress unused-import for sysRole（保留供未来 menu-by-role 优化）
void sysRole;
