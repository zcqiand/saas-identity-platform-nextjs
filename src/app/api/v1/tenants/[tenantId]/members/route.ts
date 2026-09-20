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
import { eq, and, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sysUser, tenantMember } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";
import { getMemberRoleIdsBatch, MEMBER_STATUS_TO_SMALLINT, smallintToMemberStatus } from "@/lib/member-roles";

const PAGE_DEFAULT = 20;
const PAGE_MAX = 100;

// M01.F04.I03 createUser body（对齐 TypeSpec CreateUserRequest；
// 5.59 T16：username min2→min1 归位，此前 min 与契约 @minLength(1) 漂移）
// password min8/max256 对齐契约 @minLength(8) @maxLength(256)（5.59 D-2 双边收紧）
const CreateUserBody = z.object({
  username: z.string().min(1).max(64),
  email: z.string().email(),
  // 本地防御性收紧，超出 TSP 契约（5.59 C-3 人裁 2026-09-20 维持现状）
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

    // tenantMember 限定此 tenant，status 过滤（4 值契约，未知值 → 400）
    let memberWhere: SQL = eq(tenantMember.tenantId, tenantId);
    if (statusParam) {
      const statusNum =
        MEMBER_STATUS_TO_SMALLINT[statusParam as keyof typeof MEMBER_STATUS_TO_SMALLINT];
      if (statusNum === undefined) {
        return NextResponse.json(
          { code: "BAD_REQUEST", message: `Invalid status: ${statusParam}` },
          { status: 400 },
        );
      }
      memberWhere =
        and(eq(tenantMember.tenantId, tenantId), eq(tenantMember.status, statusNum)) ??
        memberWhere;
    }

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantMember)
      .where(memberWhere);
    const total = totalResult[0]?.count ?? 0;

    const items = await db
      .select({
        memberId: tenantMember.id,
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

    // roleIds 真值链：tenant_member_role ⨝ sys_role（按 sys_role.tenant_id 过滤），批量防 N+1
    const roleMap = await getMemberRoleIdsBatch(
      items.map((u) => u.memberId),
      tenantId,
    );
    return NextResponse.json({
      items: items.map((u) => ({
        id: u.id,
        tenantId,
        username: u.username,
        email: u.email,
        status: smallintToMemberStatus(u.memberStatus),
        roleIds: roleMap.get(u.memberId) ?? [],
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

    const nowIso = new Date().toISOString();
    const password = `plain:${parsed.data.password}`; // Phase 5：argon2
    // id 由 DB 默认生成（不本地 randomUUID 再另插 —— 本地 id 与 DB 生成的行 id
    // 不一致会让下面 tenantMember 的 FK 撞 23503，2026-09-10 修）。
    const inserted = await db
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
    const id = inserted[0]?.id;
    if (!id) {
      return NextResponse.json({ code: "INTERNAL", message: "insert returned no id" }, { status: 500 });
    }
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
