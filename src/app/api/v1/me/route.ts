// /api/v1/me — M00.F02.I01 / I02（v0.4.0 anchor 2）
//
// TypeSpec: tsp/routes/me.tsp whoami() / listMyTenants()
// 语义：
//   - GET → 当前用户的 CurrentUser（含 memberships 数组 + currentTenantId）
//   - 不需要 tenant scope（不像 /tenants/:tenantId/users 要 tenant guard）
//   - JWT 必填（无 token → 401）
//
// 2026-09-09 schema pivot：users → sysUser（无 tenantId/displayName 列），
// tenantMemberships → tenantMember（无 roleIds/joinedAt 列）。
// 2026-09-12 四方对齐：joinedAt 统一 toISOString（drizzle mode:'string' 裸吐 PG 原始串）。

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sysUser, tenantMember } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";
import { getMemberRoleIdsBatch, smallintToMemberStatus } from "@/lib/member-roles";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const claims = await verifyPathTenant(null, req.headers.get("authorization"));
    if (!claims.sub) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "JWT missing sub claim" },
        { status: 401 },
      );
    }

    const userRows = await db
      .select({
        id: sysUser.id,
        email: sysUser.email,
        mobile: sysUser.mobile,
      })
      .from(sysUser)
      .where(eq(sysUser.id, claims.sub))
      .limit(1);

    const user = userRows[0];
    if (!user) {
      return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
    }

    // 拉所有 active memberships（status=1）
    const memberships = await db
      .select({
        id: tenantMember.id,
        userId: tenantMember.userId,
        tenantId: tenantMember.tenantId,
        memberName: tenantMember.memberName,
        isOwner: tenantMember.isOwner,
        status: tenantMember.status,
        createdAt: tenantMember.createdAt,
        updatedAt: tenantMember.updatedAt,
      })
      .from(tenantMember)
      .where(and(eq(tenantMember.userId, user.id), eq(tenantMember.status, 1)));

    const currentTenantId = claims.tenant_id ?? memberships[0]?.tenantId ?? undefined;

    // roleIds 真值链：tenant_member_role ⨝ sys_role（roleIds 挂 tenant_member.id，
    // sys_role 按 tenant 分域 —— 按租户分组批量查，防 N+1）
    const byTenant = new Map<string, string[]>();
    for (const m of memberships) {
      const ids = byTenant.get(m.tenantId) ?? [];
      ids.push(m.id);
      byTenant.set(m.tenantId, ids);
    }
    const roleMapByTenant = new Map<string, Map<string, string[]>>();
    for (const [tid, memberIds] of byTenant) {
      roleMapByTenant.set(tid, await getMemberRoleIdsBatch(memberIds, tid));
    }

    return NextResponse.json({
      id: user.id,
      email: user.email ?? undefined,
      memberships: memberships.map((m) => ({
        id: m.id,
        userId: m.userId,
        tenantId: m.tenantId,
        roleIds: roleMapByTenant.get(m.tenantId)?.get(m.id) ?? [],
        status: smallintToMemberStatus(m.status),
        joinedAt: new Date(m.createdAt).toISOString(),
      })),
      currentTenantId,
    });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
