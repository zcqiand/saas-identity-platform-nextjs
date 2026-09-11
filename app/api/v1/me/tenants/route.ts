// /api/v1/me/tenants — M00.F02.I02
//
// TypeSpec: tsp/routes/me.tsp listMyTenants(): TenantMembership[]
// 列出当前用户所有租户成员关系
//
// 2026-09-09 schema pivot：tenantMemberships → tenantMember（无 roleIds/joinedAt）。

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantMember } from "@/db/schema";
import { claimsFromAuthHeader, JwtParseError } from "@/lib/jwt";

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
  return NextResponse.json(
    memberships
      .filter((m) => m.status === 1)
      .map((m) => ({
        id: m.id,
        userId: m.userId,
        tenantId: m.tenantId,
        roleIds: [] as string[],
        status: "active",
        joinedAt: m.createdAt,
      })),
  );
}
