// /api/v1/tenants/:tenantId/roles/:roleId/menus — M00.F04.I02 / M00.F04.I03 / M00.F04.I04
//
// TypeSpec: tsp/routes/tenant-role-menus.tsp
// - listRoleMenus(): RoleMenuGrant
// - setRoleMenus(@body body: SetRoleMenusRequest): RoleMenuGrant
// - clearRoleMenus(): void
// GET / PUT / DELETE
//
// 2026-09-09 schema pivot：roleMenuGrants → sysRoleMenu(roleId, menuId)；
// 旧 role_menu_grants 有 tenantId 列，新 sys_role_menu 只有 (roleId, menuId) PK。

import { NextRequest, NextResponse } from "next/server";
import { eq, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sysRole, sysRoleMenu } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const SetBody = z.object({
  menuIds: z.array(z.string().uuid()),
});

async function ensureRole(tenantId: string, roleId: string) {
  const r = await db
    .select({ id: sysRole.id })
    .from(sysRole)
    .where(and(eq(sysRole.tenantId, tenantId), eq(sysRole.id, roleId)))
    .limit(1);
  return r[0];
}

async function loadMenuIdsForRole(roleId: string): Promise<string[]> {
  const rows = await db
    .select({ menuId: sysRoleMenu.menuId })
    .from(sysRoleMenu)
    .where(eq(sysRoleMenu.roleId, roleId));
  return rows.map((r) => r.menuId);
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; roleId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, roleId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const r = await ensureRole(tenantId, roleId);
    if (!r) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Role not found" }, { status: 404 });
    }
    const menuIds = await loadMenuIdsForRole(roleId);
    return NextResponse.json({
      roleId,
      tenantId,
      menuIds,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; roleId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, roleId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const r = await ensureRole(tenantId, roleId);
    if (!r) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Role not found" }, { status: 404 });
    }
    const parsed = SetBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body" },
        { status: 400 },
      );
    }
    // 整批替换：先删旧 roleId 关联的所有菜单，再插新
    await db.delete(sysRoleMenu).where(eq(sysRoleMenu.roleId, roleId));
    if (parsed.data.menuIds.length > 0) {
      await db
        .insert(sysRoleMenu)
        .values(parsed.data.menuIds.map((menuId) => ({ roleId, menuId })));
    }
    return NextResponse.json({
      roleId,
      tenantId,
      menuIds: parsed.data.menuIds,
      updatedAt: new Date().toISOString(),
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; roleId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, roleId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    await db.delete(sysRoleMenu).where(eq(sysRoleMenu.roleId, roleId));
    void inArray; // 保留以备批量
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}
