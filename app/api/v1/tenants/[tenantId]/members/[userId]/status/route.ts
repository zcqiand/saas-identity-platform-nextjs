// /api/v1/tenants/[t]/members/:userId/status — M00.F02.I08
//
// TypeSpec: tsp/routes/tenant-members.tsp changeUserStatus(@path tenantId, @path userId, @body body: { status: UserStatus }): User
//
// 2026-09-09 schema pivot：user.status 由 tenantMember.status 表达（smallint）。

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tenantMember, sysUser } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const Body = z.object({
  status: z.enum(["active", "invited", "suspended", "disabled"]),
});

export async function PATCH(
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
    const statusNum = parsed.data.status === "active" || parsed.data.status === "invited" ? 1 : 0;
    const updated = await db
      .update(tenantMember)
      .set({ status: statusNum, updatedAt: new Date().toISOString() })
      .where(and(eq(tenantMember.tenantId, tenantId), eq(tenantMember.userId, userId)))
      .returning();
    const m = updated[0];
    if (!m) {
      return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
    }
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
      status: parsed.data.status,
      roleIds: [] as string[],
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}
