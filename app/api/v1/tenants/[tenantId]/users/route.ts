// /api/v1/tenants/:tenantId/users — M01.F01.I01（v0.4.0 anchor 3）
//
// TypeSpec: tsp/routes/tenant-users.tsp listUsers(@path tenantId, @query page?, @query pageSize?, @query status?): Page<User>
// 语义：
//   - GET → Page<User>（tenant-scoped 用户列表）
//   - tenant guard 第一行：路径 :tenantId 与 JWT tenant_id 比对
//   - 支持分页（page, pageSize）
//   - 支持 status 过滤

import { NextRequest, NextResponse } from "next/server";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db";
import { users, tenantMemberships } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const PAGE_DEFAULT = 20;
const PAGE_MAX = 100;

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