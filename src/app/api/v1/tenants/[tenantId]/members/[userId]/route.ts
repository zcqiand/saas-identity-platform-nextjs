// /api/v1/tenants/[t]/members/:userId — M00.F02.I03 / M00.F02.I04 / M00.F02.I05
// 同路径支持 GET / PATCH / DELETE
//
// TypeSpec:
// - getUser(@path tenantId, @path userId): User
// - updateUser(@path tenantId, @path userId, @body body): User
// - deleteUser(@path tenantId, @path userId): void
//
// 2026-09-09 schema pivot：users → sysUser（无 tenantId/displayName），
// tenantMemberships → tenantMember（无 roleIds）。

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sysUser, tenantMember } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";
import { getMemberRoleIds, MEMBER_STATUS_TO_SMALLINT, smallintToMemberStatus } from "@/lib/member-roles";

const UpdateUserBody = z.object({
  email: z.string().email().optional(),
  mobile: z.string().optional(),
  // ADR-0032：TenantMemberStatus 4 值
  status: z.enum(["active", "invited", "suspended", "disabled"]).optional(),
});

async function findMember(tenantId: string, userId: string) {
  const rows = await db
    .select({
      id: tenantMember.id,
      userId: tenantMember.userId,
      tenantId: tenantMember.tenantId,
      memberStatus: tenantMember.status,
      username: sysUser.username,
      email: sysUser.email,
      mobile: sysUser.mobile,
      createdAt: sysUser.createdAt,
      updatedAt: sysUser.updatedAt,
    })
    .from(tenantMember)
    .innerJoin(sysUser, eq(sysUser.id, tenantMember.userId))
    .where(and(eq(tenantMember.tenantId, tenantId), eq(tenantMember.userId, userId)))
    .limit(1);
  return rows[0];
}

// roleIds 真值链：tenant_member_role ⨝ sys_role（u.id 是 tenant_member.id）
function toDto(u: NonNullable<Awaited<ReturnType<typeof findMember>>>, roleIds: string[]) {
  return {
    id: u.userId,
    tenantId: u.tenantId,
    username: u.username,
    email: u.email,
    status: smallintToMemberStatus(u.memberStatus),
    roleIds,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; userId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, userId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const u = await findMember(tenantId, userId);
    if (!u) {
      return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
    }
    return NextResponse.json(toDto(u, await getMemberRoleIds(u.id, tenantId)));
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; userId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, userId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const parsed = UpdateUserBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const existing = await findMember(tenantId, userId);
    if (!existing) {
      return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
    }
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (parsed.data.email !== undefined) patch.email = parsed.data.email;
    if (parsed.data.mobile !== undefined) patch.mobile = parsed.data.mobile;
    await db.update(sysUser).set(patch).where(eq(sysUser.id, userId));
    if (parsed.data.status !== undefined) {
      await db
        .update(tenantMember)
        .set({
          status: MEMBER_STATUS_TO_SMALLINT[parsed.data.status],
          updatedAt: new Date().toISOString(),
        })
        .where(
          and(eq(tenantMember.tenantId, tenantId), eq(tenantMember.userId, userId)),
        );
    }
    const after = await findMember(tenantId, userId);
    if (!after) {
      return NextResponse.json({ code: "NOT_FOUND", message: "User not found after update" }, { status: 404 });
    }
    return NextResponse.json(toDto(after, await getMemberRoleIds(after.id, tenantId)));
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; userId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, userId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    // 仅删 membership；sys_user 跨租户共享
    await db
      .delete(tenantMember)
      .where(and(eq(tenantMember.tenantId, tenantId), eq(tenantMember.userId, userId)));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}
