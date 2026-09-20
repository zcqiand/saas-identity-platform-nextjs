// /api/v1/tenants/:tenantId/applications — M00.F05 租户应用订阅
//
// TypeSpec: tsp/routes/tenant-applications.tsp
// - listTenantApplications(@query page?, @query pageSize?): Page<TenantApplication>
// - subscribeTenantApplication(@body body: SubscribeTenantApplicationRequest): TenantApplication
//
// 2026-09-12 补实现：此前 nextjs 后端缺此路由（orval 只生成前端调用端，
// 后端 Route Handler 是手写层 —— 该端点只在 msw/aspnetcore/springboot 实现）。

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { oauthClient, tenantApplication } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const SubscribeBody = z.object({
  // 5.59 A-1：删超契约 max64 贴契约（SubscribeTenantApplicationRequest.clientId 无约束；min1 保底）
  clientId: z.string().min(1),
  expireTime: z.string().optional(),
});

function toView(row: typeof tenantApplication.$inferSelect) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    clientId: row.clientId,
    status: row.status,
    expireTime: row.expireTime ?? undefined,
    createdAt: row.createdAt,
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const url = new URL(req.url);
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
    const items = await db
      .select()
      .from(tenantApplication)
      .where(eq(tenantApplication.tenantId, tenantId));
    return NextResponse.json({
      items: items.slice(page * pageSize, page * pageSize + pageSize).map(toView),
      page,
      pageSize,
      total: items.length,
    });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const body = SubscribeBody.safeParse(await req.json().catch(() => null));
    if (!body.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "clientId is required" },
        { status: 400 },
      );
    }
    const { clientId, expireTime } = body.data;
    // FK tenant_application.client_id → oauth_client.client_id：未知 client 直接 400（否则 DB FK 500）
    const client = await db
      .select({ clientId: oauthClient.clientId })
      .from(oauthClient)
      .where(eq(oauthClient.clientId, clientId))
      .limit(1);
    if (!client[0]) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Unknown clientId" }, { status: 404 });
    }
    const dup = await db
      .select({ id: tenantApplication.id })
      .from(tenantApplication)
      .where(
        and(eq(tenantApplication.tenantId, tenantId), eq(tenantApplication.clientId, clientId)),
      )
      .limit(1);
    if (dup[0]) {
      return NextResponse.json(
        { code: "CONFLICT", message: "already subscribed" },
        { status: 409 },
      );
    }
    const inserted = await db
      .insert(tenantApplication)
      .values({
        tenantId,
        clientId,
        status: 1,
        expireTime: expireTime ?? null,
      })
      .returning();
    return NextResponse.json(toView(inserted[0]!), { status: 201 });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
