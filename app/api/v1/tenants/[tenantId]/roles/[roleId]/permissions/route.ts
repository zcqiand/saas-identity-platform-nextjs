// /api/v1/tenants/:tenantId/roles/:roleId/permissions — M02.F02.I01
//
// TypeSpec: setPermissions(@body body: { permissionIds: string[] }): Role
// 整批替换 role ↔ permission 关系（PUT）

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { roles, rolePermissions } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const Body = z.object({
  permissionIds: z.array(z.string().uuid()),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; roleId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, roleId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body" },
        { status: 400 },
      );
    }
    // 校验 role 存在
    const roleRow = await db
      .select({ id: roles.id })
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.id, roleId)))
      .limit(1);
    if (!roleRow[0]) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Role not found" }, { status: 404 });
    }
    // 整批替换：删旧 + 插新（PG 无 MERGE UPSERT on junction）
    await db
      .delete(rolePermissions)
      .where(eq(rolePermissions.roleId, roleId));
    if (parsed.data.permissionIds.length > 0) {
      await db
        .insert(rolePermissions)
        .values(
          parsed.data.permissionIds.map((pid) => ({ roleId, permissionId: pid })),
        );
    }
    const r = (await db
      .select()
      .from(roles)
      .where(and(eq(roles.tenantId, tenantId), eq(roles.id, roleId)))
      .limit(1))[0]!;
    return NextResponse.json({
      id: r.id,
      tenantId: r.tenantId,
      code: r.code,
      name: r.name,
      description: r.description ?? undefined,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}