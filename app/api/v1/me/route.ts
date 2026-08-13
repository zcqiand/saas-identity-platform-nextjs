// /api/v1/me — M00.F02.I01 / I02（v0.4.0 anchor 2）
//
// TypeSpec: tsp/routes/me.tsp whoami() / listMyTenants()
// 语义：
//   - GET → 当前用户的 CurrentUser（含 memberships 数组 + currentTenantId）
//   - 不需要 tenant scope（不像 /tenants/:tenantId/users 要 tenant guard）
//   - JWT 必填（无 token → 401）

import { NextRequest, NextResponse } from "next/server";
import { eq, and, ne } from "drizzle-orm";
import { db } from "@/db";
import { users, tenantMemberships } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    // pathTenantId=null：因为 /me 不在 tenant-scoped 路径下
    const claims = verifyPathTenant(null, req.headers.get("authorization"));
    if (!claims.sub) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "JWT missing sub claim" },
        { status: 401 },
      );
    }

    // 用户的 global identity = tenant_memberships.user_id 引用 users.id；
    // 「当前用户」是 users 行（在某个 tenant 内），sub 对应 users.id。
    // 我们按 user_id 找到所有 tenant_memberships 聚合为 CurrentUser。
    const userRows = await db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(eq(users.id, claims.sub))
      .limit(1);

    const user = userRows[0];
    if (!user) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "User not found" },
        { status: 404 },
      );
    }

    // 拉所有 memberships
    const memberships = await db
      .select({
        id: tenantMemberships.id,
        userId: tenantMemberships.userId,
        tenantId: tenantMemberships.tenantId,
        roleIds: tenantMemberships.roleIds,
        status: tenantMemberships.status,
        joinedAt: tenantMemberships.joinedAt,
      })
      .from(tenantMemberships)
      .where(
        and(
          eq(tenantMemberships.userId, user.id),
          ne(tenantMemberships.status, "removed"),
        ),
      );

    // currentTenantId = JWT 里的 tenant_id（如果有）
    const currentTenantId = claims.tenant_id ?? user.tenantId;

    return NextResponse.json({
      id: user.id,
      email: user.email,
      displayName: user.displayName ?? undefined,
      memberships,
      currentTenantId,
    });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}