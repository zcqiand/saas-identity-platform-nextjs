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
import {
  getMemberRoleIds,
  MEMBER_STATUS_TO_SMALLINT,
  smallintToMemberStatus,
} from "@/lib/member-roles";

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
      return NextResponse.json({ code: "BAD_REQUEST", message: "Invalid body" }, { status: 400 });
    }
    // seed 约定（ADR-0032）：1=active 2=invited 3=suspended 0=disabled
    const statusNum = MEMBER_STATUS_TO_SMALLINT[parsed.data.status];
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
      // 回显 DB 真值（写进去的 smallint 换回字符串），不是请求字面
      status: smallintToMemberStatus(m.status),
      // m.id 是 tenant_member.id；roleIds 真值链 tenant_member_role ⨝ sys_role
      roleIds: await getMemberRoleIds(m.id, tenantId),
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}
