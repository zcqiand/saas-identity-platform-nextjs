// /api/v1/me/tenants/:tenantId/switch — M00.F02.I03
//
// TypeSpec: tsp/routes/me.tsp switchTenant(@path tenantId): SwitchTenantResponse
// 切换当前租户：返回新 tenant-scoped accessToken（payload 含新 tenant_id）
//
// 简化逻辑：当前用户必须是该租户的 member；签发新 JWT（Phase 5 HS256 + jose；不维护 refresh_token 表）

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships } from "@/db/schema";
import { claimsFromAuthHeader, signToken } from "@/lib/jwt";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const { tenantId } = await params;
  const claims = await claimsFromAuthHeader(req.headers.get("authorization"));
  if (!claims?.sub) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing JWT sub" }, { status: 401 });
  }
  const m = await db
    .select()
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.userId, claims.sub), eq(tenantMemberships.tenantId, tenantId)))
    .limit(1);
  if (!m[0] || m[0].status === "removed") {
    // 2026-08-31 contract-test M96.F02.I28：家族统一非成员/不存在 → 404
    // （msw oracle / aspnetcore / springboot 同款；原 403 FORBIDDEN 与四方分叉）
    return NextResponse.json(
      { code: "NOT_FOUND", message: "tenant 不存在或不是该租户成员" },
      { status: 404 },
    );
  }
  const accessToken = await signToken({ sub: claims.sub, tenant_id: tenantId });
  return NextResponse.json({
    accessToken,
    refreshToken: `refresh-${claims.sub}-${Date.now()}`,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    tenantId,
  });
}