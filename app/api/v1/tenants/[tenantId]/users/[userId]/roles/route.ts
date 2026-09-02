// /api/v1/tenants/:tenantId/users/:userId/roles — M01.F02.I01
//
// TypeSpec: tsp/routes/tenant-users.tsp assignRoles(@path tenantId, @path userId, @body body: { roleIds: string[] }): User
// 整批替换用户 role 列表（PUT 语义）
//
// 2026-09-01 contract-test I40：users.roleIds 是冗余列，authoritative 在
// tenant_memberships.roleIds（家族约定，GET 侧 LEFT JOIN 取真值）。
// 只写冗余列 = 写完读回 []。本端点同步写两侧。

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, tenantMemberships } from "@/db/schema";
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
    const updated = await db
      .update(users)
      .set({ roleIds: parsed.data.roleIds, updatedAt: new Date() })
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .returning();
    const u = updated[0];
    if (!u) {
      return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
    }
    // authoritative 侧同步：tenant_memberships.roleIds（GET 从这里读真值）
    const m = await db
      .select({ id: tenantMemberships.id })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.tenantId, tenantId),
          eq(tenantMemberships.userId, userId),
        ),
      )
      .limit(1);
    if (m[0]) {
      await db
        .update(tenantMemberships)
        .set({ roleIds: parsed.data.roleIds })
        .where(eq(tenantMemberships.id, m[0].id));
    } else {
      await db.insert(tenantMemberships).values({
        tenantId,
        userId,
        roleIds: parsed.data.roleIds,
        status: "active",
      });
    }
    return NextResponse.json({
      id: u.id,
      tenantId: u.tenantId,
      username: u.username,
      email: u.email,
      displayName: u.displayName ?? undefined,
      status: u.status,
      roleIds: (u.roleIds ?? []).map((r) => r),
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}
