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
// 3. tenant_member_role → sys_role → sys_role_menu → menuIds（授权集）
// 4. 遍历所有 active oauthClient，授权集 ∪ 祖先闭包建树（aspnetcore oracle 同构）：
//    未授权祖先作为容器进树，未授权菜单本身不出现
//
// 2026-09-12 四方对齐修复（I05 crm 组空数组）：
// - PG 里根菜单 parent_id = 全零哨兵 UUID（非 NULL，schema default），旧代码只把
//   parentId === null 当根 → 全部节点成孤儿 → 每个 app 都输出 []。
// - 出参根节点 parentId 归一为 null（msw oracle 形态；normalize null≡缺失）。
// - type smallint(1/2/3) → "directory"/"menu"/"button"（msw/aspnetcore 同码表）。

import { NextRequest, NextResponse } from "next/server";
import { eq, and, asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  oauthClient,
  sysMenu,
  tenantMember,
  tenantMemberRole,
  sysRole,
  sysRoleMenu,
} from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

type MenuRow = {
  id: string;
  clientId: string;
  parentId: string | null;
  title: string;
  type: "directory" | "menu" | "button";
  path: string | null;
  icon: string | null;
  sortOrder: number;
};

type EffectiveMenuNode = MenuRow & { children: EffectiveMenuNode[] };

// PG 根菜单的 parent_id 哨兵（sys_menu.parent_id notNull default 全零 UUID）
const ROOT_PARENT_ID = "00000000-0000-0000-0000-000000000000";

function typeFromSmallint(n: number): "directory" | "menu" | "button" {
  if (n === 1) return "directory";
  if (n === 2) return "menu";
  return "button";
}

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

    // 5. 授权集 ∪ 祖先闭包（aspnetcore MeController 同构）：从授权菜单出发，
    //    沿 parent_id 向上收未授权祖先作容器；未授权菜单本身不进树。
    const byId = new Map(allRows.map((m) => [m.id, m]));
    const included = new Set<string>();
    for (const id of allowed) {
      let cur = byId.get(id);
      while (cur && !included.has(cur.id)) {
        included.add(cur.id);
        cur = cur.parentId && cur.parentId !== ROOT_PARENT_ID ? byId.get(cur.parentId) : undefined;
      }
    }

    const result: Record<string, EffectiveMenuNode[]> = {};
    for (const c of activeClients) {
      const byParent = new Map<string | null, MenuRow[]>();
      for (const m of allRows) {
        if (m.clientId !== c.clientId || !included.has(m.id)) continue;
        // 哨兵 parent ≡ 根 → 归一为 null（msw oracle 形态）
        const key = !m.parentId || m.parentId === ROOT_PARENT_ID ? null : m.parentId;
        if (!byParent.has(key)) byParent.set(key, []);
        byParent.get(key)!.push({
          id: m.id,
          clientId: m.clientId,
          parentId: m.parentId === ROOT_PARENT_ID ? null : m.parentId,
          title: m.title,
          type: typeFromSmallint(m.type),
          path: m.path ?? null,
          icon: m.icon ?? null,
          sortOrder: m.sortOrder,
        });
      }
      // 只有该 app 下确有可见根节点才占位（授权集为空 → 无任何 app 分组）
      const roots = byParent.get(null) ?? [];
      if (roots.length > 0) {
        const build = (parentId: string | null): EffectiveMenuNode[] =>
          (byParent.get(parentId) ?? []).map((m) => ({
            ...m,
            children: build(m.id),
          }));
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
