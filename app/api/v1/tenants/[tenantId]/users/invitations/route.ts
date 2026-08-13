// /api/v1/tenants/:tenantId/users/invitations — M01.F02.I02
//
// TypeSpec: tsp/routes/tenant-users.tsp inviteUser(@path tenantId, @body body: { email: string; roleIds?: string[] }): User
// 邀请用户：创建 invited 状态的用户行；password 由后续「首次登录设置」流程补齐（Phase 6）

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const Body = z.object({
  email: z.string().email(),
  roleIds: z.array(z.string().uuid()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;
    verifyPathTenant(tenantId, req.headers.get("authorization"));
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body" },
        { status: 400 },
      );
    }
    // 从 email 派生 username（本地部分）；实际生产需要独立字段或邀请 token
    const username = parsed.data.email.split("@")[0]!;
    const inserted = await db
      .insert(users)
      .values({
        tenantId,
        username,
        email: parsed.data.email,
        status: "invited",
        roleIds: parsed.data.roleIds ?? [],
      })
      .onConflictDoNothing({ target: [users.tenantId, users.email] })
      .returning();
    if (!inserted[0]) {
      // 重复 email：返回现有 user
      const existing = await db
        .select()
        .from(users)
        .where(eq(users.tenantId, tenantId))
        .limit(50); // 简化：全表扫一次限定 50
      const match = existing.find((u) => u.email === parsed.data.email);
      if (!match) {
        return NextResponse.json({ code: "CONFLICT", message: "Email exists" }, { status: 409 });
      }
      return NextResponse.json({
        id: match.id,
        tenantId: match.tenantId,
        username: match.username,
        email: match.email,
        displayName: match.displayName ?? undefined,
        status: match.status,
        roleIds: (match.roleIds ?? []).map((r) => r),
        createdAt: match.createdAt.toISOString(),
        updatedAt: match.updatedAt.toISOString(),
      });
    }
    const u = inserted[0]!;
    return NextResponse.json({
      id: u.id,
      tenantId: u.tenantId,
      username: u.username,
      email: u.email,
      displayName: u.displayName ?? undefined,
      status: u.status,
      roleIds: (u.roleIds ?? []).map((r) => r),
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}