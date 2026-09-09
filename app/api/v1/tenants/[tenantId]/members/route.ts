// /api/v1/tenants/[t]/members — M01.F01.I01/I02（v0.4.0 anchor 3）
//
// TypeSpec: tsp/routes/tenant-members.tsp listUsers(@path tenantId, @query page?, @query pageSize?, @query status?): Page<User>
//            + createUser(@path tenantId, @body body: CreateUserRequest): User | ErrorResponse
// 语义：
//   - GET → Page<User>（tenant-scoped 用户列表）
//   - POST → 新建 user，status 固定 active（契约面：contract-test I19 要求 4 后端一致）
//   - tenant guard 第一行：路径 :tenantId 与 JWT tenant_id 比对
//   - 支持分页（page, pageSize）
//   - 支持 status 过滤
//
// 2026-09-09 schema pivot：
// - users → sysUser（无 tenantId 列；多租户通过 tenantMember 关联）
// - tenantMemberships → tenantMember（无 roleIds/displayName 列）
// - 列表改为：找 tenantMember + LEFT JOIN sysUser

import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sysUser, tenantMember } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const PAGE_DEFAULT = 20;
const PAGE_MAX = 100;

// M01.F04.I03 createUser body（对齐 TypeSpec CreateUserRequest）
const CreateUserBody = z.object({
  username: z.string().min(2).max(64),
  email: z.string().email(),
  mobile: z.string().max(32).optional(),
  password: z.string().min(8).max(256),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;

    await verifyPathTenant(tenantId, req.headers.get("authorization"));

    const url = new URL(req.url);
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const pageSize = Math.min(
      PAGE_MAX,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? PAGE_DEFAULT)),
    );
    const statusParam = url.searchParams.get("status");

    // tenantMember 限定此 tenant，status 过滤
    const memberWhere = statusParam
      ? and(
          eq(tenantMember.tenantId, tenantId),
          eq(tenantMember.status, statusParam === "active" ? 1 : 0),
        )
      : eq(tenantMember.tenantId, tenantId);

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantMember)
      .where(memberWhere);
    const total = totalResult[0]?.count ?? 0;

    const items = await db
      .select({
        id: sysUser.id,
        username: sysUser.username,
        email: sysUser.email,
        mobile: sysUser.mobile,
        status: sysUser.status,
        memberStatus: tenantMember.status,
        createdAt: sysUser.createdAt,
        updatedAt: sysUser.updatedAt,
      })
      .from(tenantMember)
      .innerJoin(sysUser, eq(sysUser.id, tenantMember.userId))
      .where(memberWhere)
      .limit(pageSize)
      .offset(page * pageSize)
      .orderBy(sql`created_at DESC`);

    return NextResponse.json({
      items: items.map((u) => ({
        id: u.id,
        tenantId,
        username: u.username,
        email: u.email,
        displayName: u.mobile ?? undefined,
        status: u.memberStatus === 1 ? "active" : "disabled",
        roleIds: [] as string[],
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      })),
      page,
      pageSize,
      total,
    });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

// M01.F04.I03 / M96.F02.I19 — POST 创建 user。
//
// 契约面（contract-test）：status 固定 "active"，4 后端必须一致。
// TypeSpec CreateUserRequest 不含 status，server-side 决定；选 active（"已激活账号"语义）
// 与 INVITED 路径（POST /users/invitations）区分开。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;

    await verifyPathTenant(tenantId, req.headers.get("authorization"));

    const parsed = CreateUserBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: parsed.error.message },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const nowIso = new Date().toISOString();
    const password = `plain:${parsed.data.password}`; // Phase 5：argon2
    await db
      .insert(sysUser)
      .values({
        username: parsed.data.username,
        email: parsed.data.email,
        mobile: parsed.data.mobile ?? null,
        password,
        status: 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      })
      .returning({ id: sysUser.id });
    // 同步建 tenantMember（active=1）
    await db.insert(tenantMember).values({
      tenantId,
      userId: id,
      memberName: parsed.data.username,
      isOwner: false,
      status: 1,
    });

    // M06.F03 审计写入已废止（audit_events 表 DROP），user_created 不再写审计。

    return NextResponse.json(
      {
        id,
        tenantId,
        username: parsed.data.username,
        email: parsed.data.email,
        displayName: parsed.data.mobile ?? undefined,
        status: "active",
        roleIds: [] as string[],
        createdAt: nowIso,
        updatedAt: nowIso,
      },
      { status: 201 },
    );
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
