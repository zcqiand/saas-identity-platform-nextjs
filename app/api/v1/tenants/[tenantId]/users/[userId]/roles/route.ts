// /api/v1/tenants/:tenantId/users/:userId/roles — M01.F02.I01
//
// TypeSpec: tsp/routes/tenant-users.tsp assignRoles(@path tenantId, @path userId, @body body: { roleIds: string[] }): User
// 整批替换用户 role 列表（PUT 语义）
//
// 2026-09-09 schema pivot：users → sysUser；tenantMemberships → tenantMember；
// tenant_role_menu_grants → tenantMemberRole。authoritative role 关系是
// tenantMemberRole(memberId, roleId) — 通过 tenantMember.id 关联。

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sysUser, tenantMember, tenantMemberRole } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const Body = z.object({
  roleIds: z.array(z.string().uuid()),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; userId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, userId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body" },
        { status: 400 },
      );
    }

    // 找 membership
    const mRows = await db
      .select({ id: tenantMember.id })
      .from(tenantMember)
      .where(and(eq(tenantMember.tenantId, tenantId), eq(tenantMember.userId, userId)))
      .limit(1);
    if (!mRows[0]) {
      return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
    }
    const memberId = mRows[0].id;

    // 整批替换：删旧 + 插新（PG 无 MERGE UPSERT on junction）
    await db.delete(tenantMemberRole).where(eq(tenantMemberRole.memberId, memberId));
    if (parsed.data.roleIds.length > 0) {
      await db
        .insert(tenantMemberRole)
        .values(parsed.data.roleIds.map((roleId) => ({ memberId, roleId })));
    }

    // 拉取 user 行
    const uRows = await db
      .select({
        id: sysUser.id,
        username: sysUser.username,
        email: sysUser.email,
        mobile: sysUser.mobile,
        createdAt: sysUser.createdAt,
        updatedAt: sysUser.updatedAt,
      })
      .from(sysUser)
      .where(eq(sysUser.id, userId))
      .limit(1);
    const u = uRows[0];
    if (!u) {
      return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: u.id,
      tenantId,
      username: u.username,
      email: u.email,
      displayName: u.mobile ?? undefined,
      status: "active",
      roleIds: parsed.data.roleIds,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}
