// /api/v1/tenants/:tenantId/roles/:roleId/menus — M09.F01.I01 / M09.F02.I02 / M09.F02.I03
//
// TypeSpec: tsp/routes/tenant-role-menus.tsp
// - listRoleMenus(): RoleMenuGrant
// - setRoleMenus(@body body: SetRoleMenusRequest): RoleMenuGrant
// - clearRoleMenus(): void
// GET / PUT / DELETE

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { roleMenuGrants, roles } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const SetBody = z.object({
  menuIds: z.array(z.string().uuid()),
});

async function ensureRole(tenantId: string, roleId: string) {
  const r = await db
    .select({ id: roles.id })
    .from(roles)
    .where(and(eq(roles.tenantId, tenantId), eq(roles.id, roleId)))
    .limit(1);
  return r[0];
}

function toDto(g: typeof roleMenuGrants.$inferSelect, tenantId: string) {
  return {
    roleId: g.roleId,
    tenantId,
    menuIds: g.menuIds,
    updatedAt: g.updatedAt.toISOString(),
  };
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
    const g = await db
      .select()
      .from(roleMenuGrants)
      .where(eq(roleMenuGrants.roleId, roleId))
      .limit(1);
    if (!g[0]) {
      // 没有 grant 行返回空(仍带 tenantId 兜底, contract-test 必填字段)
      return NextResponse.json({
        roleId,
        tenantId,
        menuIds: [],
        updatedAt: new Date().toISOString(),
      });
    }
    return NextResponse.json(toDto(g[0], tenantId));
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
    // 整批替换：role_menu_grants PK = role_id；upsert
    const inserted = await db
      .insert(roleMenuGrants)
      .values({
        roleId,
        tenantId,
        menuIds: parsed.data.menuIds,
      })
      .onConflictDoUpdate({
        target: roleMenuGrants.roleId,
        set: { menuIds: parsed.data.menuIds, updatedAt: new Date() },
      })
      .returning();
    return NextResponse.json(toDto(inserted[0]!, tenantId));
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
    await db
      .delete(roleMenuGrants)
      .where(eq(roleMenuGrants.roleId, roleId));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}