// /api/v1/me/tenants — M00.F02.I02
//
// TypeSpec: tsp/routes/me.tsp listMyTenants(): TenantMembership[]
// 列出当前用户所有租户成员关系

import { NextRequest, NextResponse } from "next/server";
import { eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { tenantMemberships } from "@/db/schema";
import { claimsFromAuthHeader } from "@/lib/jwt";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const claims = await claimsFromAuthHeader(req.headers.get("authorization"));
  if (!claims?.sub) {
    return NextResponse.json({ code: "UNAUTHORIZED", message: "Missing JWT sub" }, { status: 401 });
  }
  const memberships = await db
    .select()
    .from(tenantMemberships)
    .where(eq(tenantMemberships.userId, claims.sub));
  return NextResponse.json(
    memberships
      .filter((m) => m.status !== "removed")
      .map((m) => ({
        id: m.id,
        userId: m.userId,
        tenantId: m.tenantId,
        roleIds: (m.roleIds ?? []).map((r) => r),
        status: m.status,
        joinedAt: m.joinedAt.toISOString(),
      })),
  );
}