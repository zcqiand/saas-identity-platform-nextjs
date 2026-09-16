// /api/v1/tenants/:tenantId/roles/:roleId — M02.F01 详情/更新/删除
//
// TypeSpec: getRole / updateRole / deleteRole
// GET / PATCH / DELETE
//
// 2026-09-09 schema pivot：roles → sysRole（无 permissionIds）。

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sysRole } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const PatchRoleBody = z.object({
  roleName: z.string().min(1).max(64).optional(),
  description: z.string().optional(),
  status: z.number().int().optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; roleId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, roleId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const rows = await db
      .select()
      .from(sysRole)
      .where(and(eq(sysRole.tenantId, tenantId), eq(sysRole.id, roleId)))
      .limit(1);
    const r = rows[0];
    if (!r) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Role not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: r.id,
      tenantId: r.tenantId,
      clientId: r.clientId,
      roleCode: r.roleCode,
      roleName: r.roleName,
      description: r.description ?? undefined,
      isPreset: r.isPreset,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; roleId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, roleId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const parsed = PatchRoleBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body" },
        { status: 400 },
      );
    }
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (parsed.data.roleName !== undefined) patch.roleName = parsed.data.roleName;
    if (parsed.data.description !== undefined) patch.description = parsed.data.description;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    const updated = await db
      .update(sysRole)
      .set(patch)
      .where(and(eq(sysRole.tenantId, tenantId), eq(sysRole.id, roleId)))
      .returning();
    const r = updated[0];
    if (!r) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Role not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: r.id,
      tenantId: r.tenantId,
      clientId: r.clientId,
      roleCode: r.roleCode,
      roleName: r.roleName,
      description: r.description ?? undefined,
      isPreset: r.isPreset,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
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
    await db.delete(sysRole).where(and(eq(sysRole.tenantId, tenantId), eq(sysRole.id, roleId)));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}
