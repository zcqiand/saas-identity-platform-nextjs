// /api/v1/tenants/:tenantId/applications/:clientId — M00.F05.I03/I04
//
// TypeSpec: tsp/routes/tenant-applications.tsp
// - updateTenantApplication(@body body: UpdateTenantApplicationRequest): TenantApplication
// - removeTenantApplication(): void
//
// 寻址契约：路径参数是 clientId 字符串列（非 UUID id）。
// PATCH 兼容家族测试的字符串 status（"disabled" 等）与契约 int32 —— 统一归一化 0/1/2。

import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenantApplication } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

function normalizeStatus(v: unknown): number {
  if (typeof v === "number") return v;
  const s = String(v ?? "")
    .trim()
    .toLowerCase();
  if (["0", "pending"].includes(s)) return 0;
  if (["1", "active", "enabled"].includes(s)) return 1;
  if (["2", "disabled"].includes(s)) return 2;
  return Number.NaN;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; clientId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, clientId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const updates: Partial<typeof tenantApplication.$inferInsert> = {};
    if (body.status !== undefined) {
      const status = normalizeStatus(body.status);
      if (Number.isNaN(status)) {
        return NextResponse.json(
          { code: "BAD_REQUEST", message: "invalid status" },
          { status: 400 },
        );
      }
      updates.status = status;
    }
    if (body.expireTime !== undefined) {
      updates.expireTime = body.expireTime ? String(body.expireTime) : null;
    }
    const updated = await db
      .update(tenantApplication)
      .set(updates)
      .where(
        and(eq(tenantApplication.tenantId, tenantId), eq(tenantApplication.clientId, clientId)),
      )
      .returning();
    if (!updated[0]) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Subscription not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(updated[0]);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; clientId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, clientId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const deleted = await db
      .delete(tenantApplication)
      .where(
        and(eq(tenantApplication.tenantId, tenantId), eq(tenantApplication.clientId, clientId)),
      )
      .returning({ id: tenantApplication.id });
    if (!deleted[0]) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Subscription not found" },
        { status: 404 },
      );
    }
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
