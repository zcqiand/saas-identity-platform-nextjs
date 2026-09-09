// /api/v1/tenants/[t]/members/invitations — M00.F02.I06
//
// TypeSpec: tsp/routes/tenant-members.tsp inviteUser(@path tenantId, @body body: { email: string; roleIds?: string[] }): User
// 邀请用户：创建 invited 状态的用户行；password 由后续「首次登录设置」流程补齐（Phase 6）
//
// 2026-09-09 schema pivot：users → sysUser（status:smallint，invited=1）。
// sysUser 没有 tenantId；同 /users POST 一样，建 sys_user + tenant_member 两行。

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sysUser, tenantMember } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const Body = z.object({
  email: z.string().email(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body" },
        { status: 400 },
      );
    }
    const username = parsed.data.email.split("@")[0]!;
    // 先看 sys_user.email 是否已存在（全局唯一）
    const existingUser = await db
      .select({
        id: sysUser.id,
        username: sysUser.username,
        email: sysUser.email,
        mobile: sysUser.mobile,
        status: sysUser.status,
        createdAt: sysUser.createdAt,
        updatedAt: sysUser.updatedAt,
      })
      .from(sysUser)
      .where(eq(sysUser.email, parsed.data.email))
      .limit(1);
    let userRow = existingUser[0];
    if (!userRow) {
      const inserted = await db
        .insert(sysUser)
        .values({
          username,
          email: parsed.data.email,
          status: 1, // invited/active 统一为 1（dev）
          password: "invited-pending",
        })
        .returning({
          id: sysUser.id,
          username: sysUser.username,
          email: sysUser.email,
          mobile: sysUser.mobile,
          status: sysUser.status,
          createdAt: sysUser.createdAt,
          updatedAt: sysUser.updatedAt,
        });
      userRow = inserted[0];
    }
    if (!userRow) {
      return NextResponse.json({ code: "INTERNAL", message: "Insert failed" }, { status: 500 });
    }

    // 找/建 tenantMember
    const memberRows = await db
      .select({ id: tenantMember.id, status: tenantMember.status })
      .from(tenantMember)
      .where(and(eq(tenantMember.tenantId, tenantId), eq(tenantMember.userId, userRow.id)))
      .limit(1);
    if (!memberRows[0]) {
      await db.insert(tenantMember).values({
        tenantId,
        userId: userRow.id,
        memberName: username,
        isOwner: false,
        status: 1,
      });
    }
    return NextResponse.json({
      id: userRow.id,
      tenantId,
      username: userRow.username,
      email: userRow.email,
      displayName: userRow.mobile ?? undefined,
      status: "invited",
      roleIds: [] as string[],
      createdAt: userRow.createdAt,
      updatedAt: userRow.updatedAt,
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}
