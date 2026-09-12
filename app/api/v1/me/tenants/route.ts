// /api/v1/me/tenants — M00.F02.I02
//
// TypeSpec: tsp/routes/me.tsp listMyTenants(): TenantMembership[]
// 列出当前用户所有租户成员关系
//
// 2026-09-09 schema pivot：tenantMemberships → tenantMember（无 roleIds/joinedAt）。
// 2026-09-12 四方对齐：drizzle timestamp mode:'string' 裸吐 PG 原始串
// （"2026-01-20 16:00:00+08"），msw oracle 是 ISO Z → 统一 toISOString 序列化。

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantMember } from "@/db/schema";
import { claimsFromAuthHeader, JwtParseError } from "@/lib/jwt";
import { getMemberRoleIdsBatch, smallintToMemberStatus } from "@/lib/member-roles";

export async function GET(req: NextRequest): Promise<NextResponse> {
  // 过期/无效 token → 401（此前未捕获 JwtParseError，过期 token 直接 500）
  let claims;
  try {
    claims = await claimsFromAuthHeader(req.headers.get("authorization"));
  } catch (e) {
    if (!(e instanceof JwtParseError)) throw e;
    claims = null;
  }
  if (!claims?.sub) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing JWT sub" }, { status: 401 });
  }
  const memberships = await db
    .select()
    .from(tenantMember)
    .where(eq(tenantMember.userId, claims.sub));

  // roleIds 真值链：tenant_member_role ⨝ sys_role（sys_role 按 tenant 分域，按租户分组批量查）
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

  return NextResponse.json(
    memberships
      .filter((m) => m.status === 1)
      .map((m) => ({
        id: m.id,
        userId: m.userId,
        tenantId: m.tenantId,
        roleIds: roleMapByTenant.get(m.tenantId)?.get(m.id) ?? [],
        status: smallintToMemberStatus(m.status),
        joinedAt: new Date(m.createdAt).toISOString(),
      })),
  );
}
