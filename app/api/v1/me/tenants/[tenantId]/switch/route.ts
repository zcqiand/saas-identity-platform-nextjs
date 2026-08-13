// /api/v1/me/tenants/:tenantId/switch — M00.F02.I03
//
// TypeSpec: tsp/routes/me.tsp switchTenant(@path tenantId): SwitchTenantResponse
// 切换当前租户：返回新 tenant-scoped accessToken（payload 含新 tenant_id）
//
// 简化逻辑：当前用户必须是该租户的 member；签发新 JWT（Phase 5 不维护 refresh_token 表，仅重发 accessToken）

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships } from "@/db/schema";
import { claimsFromAuthHeader } from "@/lib/jwt";

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function issueAccessToken(userId: string, tenantId: string): string {
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      tenant_id: tenantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${header}.${payload}.dev-placeholder`;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  const { tenantId } = await params;
  const claims = claimsFromAuthHeader(req.headers.get("authorization"));
  if (!claims?.sub) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing JWT sub" }, { status: 401 });
  }
  const m = await db
    .select()
    .from(tenantMemberships)
    .where(and(eq(tenantMemberships.userId, claims.sub), eq(tenantMemberships.tenantId, tenantId)))
    .limit(1);
  if (!m[0] || m[0].status === "removed") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "Not a member of this tenant" },
      { status: 403 },
    );
  }
  const accessToken = issueAccessToken(claims.sub, tenantId);
  return NextResponse.json({
    accessToken,
    refreshToken: `refresh-${claims.sub}-${Date.now()}`,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    tenantId,
  });
}