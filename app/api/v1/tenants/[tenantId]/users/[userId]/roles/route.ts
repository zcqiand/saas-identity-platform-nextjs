// /api/v1/tenants/:tenantId/users/:userId/roles — M01.F02.I01
//
// TypeSpec: tsp/routes/tenant-users.tsp assignRoles(@path tenantId, @path userId, @body body: { permissionIds: string[] }): User
// 整批替换用户 role 列表（PUT 语义）

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
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