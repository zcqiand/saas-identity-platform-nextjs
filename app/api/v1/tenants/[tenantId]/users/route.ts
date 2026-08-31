// /api/v1/tenants/:tenantId/users — M01.F01.I01/I02（v0.4.0 anchor 3）
//
// TypeSpec: tsp/routes/tenant-users.tsp listUsers(@path tenantId, @query page?, @query pageSize?, @query status?): Page<User>
//            + createUser(@path tenantId, @body body: CreateUserRequest): User | ErrorResponse
// 语义：
//   - GET → Page<User>（tenant-scoped 用户列表）
//   - POST → 新建 user，status 固定 active（契约面：contract-test I19 要求 4 后端一致）
//   - tenant guard 第一行：路径 :tenantId 与 JWT tenant_id 比对
//   - 支持分页（page, pageSize）
//   - 支持 status 过滤

import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users, tenantMemberships } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";
import { writeAudit } from "@/lib/audit";

const PAGE_DEFAULT = 20;
const PAGE_MAX = 100;

// M01.F01.I02 createUser body（对齐 TypeSpec CreateUserRequest）
const CreateUserBody = z.object({
  username: z.string().min(2).max(64),
  email: z.string().email(),
  displayName: z.string().max(255).optional(),
  password: z.string().min(8).max(256),
  roleIds: z.array(z.string().uuid()).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;

    // tenant guard 第一行
    await verifyPathTenant(tenantId, req.headers.get("authorization"));

    // query params
    const url = new URL(req.url);
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const pageSize = Math.min(
      PAGE_MAX,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? PAGE_DEFAULT)),
    );
    const statusParam = url.searchParams.get("status");

    // 2026-08-30 contract-test：users.role_ids 列是冗余（drizzle/sql[] 占位），
    // authoritative 在 tenant_memberships.role_ids —— 这里 LEFT JOIN 取。
    // user 无 membership 时（不应发生，V016 seed 必建）roleIds=[]。
    const where = statusParam
      ? and(eq(users.tenantId, tenantId), eq(users.status, statusParam as "active"))
      : eq(users.tenantId, tenantId);

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(where);
    const total = totalResult[0]?.count ?? 0;

    const items = await db
      .select({
        id: users.id,
        tenantId: users.tenantId,
        username: users.username,
        email: users.email,
        displayName: users.displayName,
        status: users.status,
        roleIds: tenantMemberships.roleIds,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .leftJoin(
        tenantMemberships,
        and(
          eq(tenantMemberships.userId, users.id),
          eq(tenantMemberships.tenantId, users.tenantId),
        ),
      )
      .where(where)
      .limit(pageSize)
      .offset(page * pageSize)
      .orderBy(sql`created_at DESC`);

    return NextResponse.json({
      items: items.map((u) => ({
        ...u,
        roleIds: u.roleIds ?? [],  // Phase 5：删冗余列后这里不再需要 ??[]
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

// M01.F01.I02 / M96.F02.I19 — POST 创建 user。
//
// 契约面（contract-test）：status 固定 "active"，4 后端必须一致。
// TypeSpec CreateUserRequest 不含 status，server-side 决定；选 active（"已激活账号"语义）
// 与 INVITED 路径（POST /users/invitations）区分开。
//
// Phase 5：换 argon2.hash(body.password)；当前 plain 占位与 saas-aspnetcore / saas-springboot 同步。
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;

    // tenant guard 第一行
    await verifyPathTenant(tenantId, req.headers.get("authorization"));

    const parsed = CreateUserBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: parsed.error.message },
        { status: 400 },
      );
    }

    const id = crypto.randomUUID();
    const now = new Date();
    const passwordHash = `plain:${parsed.data.password}`; // Phase 5：argon2
    const inserted = await db
      .insert(users)
      .values({
        id,
        tenantId,
        username: parsed.data.username,
        email: parsed.data.email,
        displayName: parsed.data.displayName ?? null,
        status: "active", // 契约固定
        passwordHash,
        roleIds: parsed.data.roleIds ?? [],
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const e = inserted[0]!;

    // M06.F03.I01 写端点副作用 — user_created
    await writeAudit({
      tenantId,
      authHeader: req.headers.get("authorization"),
      action: "user_created",
      metadata: { userId: e.id },
    });

    return NextResponse.json(
      {
        id: e.id,
        tenantId: e.tenantId,
        username: e.username,
        email: e.email,
        displayName: e.displayName ?? undefined,
        status: e.status,
        roleIds: e.roleIds,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      },
      { status: 201 },
    );
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}