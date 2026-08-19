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
import { users } from "@/db/schema";
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

    // total + items（一次查询带 count）
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
        roleIds: sql<string[]>`ARRAY[]::uuid[]`,  // Phase 5：从 tenant_memberships 聚合
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      })
      .from(users)
      .where(where)
      .limit(pageSize)
      .offset(page * pageSize)
      .orderBy(sql`created_at DESC`);

    return NextResponse.json({
      items: items.map((u) => ({
        ...u,
        roleIds: [],  // Phase 5
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