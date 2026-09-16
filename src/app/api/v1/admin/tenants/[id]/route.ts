// /api/v1/admin/tenants/:id - M00.F01 单个租户（get + update + delete）
//
// TypeSpec: tsp/routes/admin-tenants.tsp
//   getTenant(@path id): Tenant
//   updateTenant(@path id, @body UpdateTenantRequest): Tenant
//   deleteTenant(@path id): void (204)
// 语义：
//   - 平台级（不 tenant-scoped）：await verifyPathTenant(null) 只要 JWT
//   - DELETE 级联清 sysUser / tenantMember / sysRole 等（FK ON DELETE CASCADE）

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenant } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const UpdateTenantBody = z.object({
  name: z.string().min(2).max(128).optional(),
  tenantKey: z.string().min(2).max(64).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

const tenantFields = {
  id: tenant.id,
  tenantKey: tenant.tenantKey,
  name: tenant.name,
  status: tenant.status,
  createdAt: tenant.createdAt,
  updatedAt: tenant.updatedAt,
};

function statusToSmallint(s: "active" | "suspended" | undefined): number | undefined {
  if (s === undefined) return undefined;
  return s === "suspended" ? 2 : 1;
}

function statusFromSmallint(n: number): "active" | "suspended" {
  return n === 2 ? "suspended" : "active";
}

async function getTenantById(id: string) {
  const rows = await db
    .select(tenantFields)
    .from(tenant)
    .where(eq(tenant.id, id))
    .limit(1);
  return rows[0];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { id } = await params;
    const t = await getTenantById(id);
    if (!t) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Tenant not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ...t, status: statusFromSmallint(t.status) });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { id } = await params;
    const parsed = UpdateTenantBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const existing = await getTenantById(id);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Tenant not found" },
        { status: 404 },
      );
    }

    const { name, tenantKey, status } = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) patch.name = name;
    if (tenantKey !== undefined) patch.tenantKey = tenantKey;
    const statusNum = statusToSmallint(status);
    if (statusNum !== undefined) patch.status = statusNum;

    if (Object.keys(patch).length === 1) {
      // 仅 updatedAt
      return NextResponse.json({ ...existing, status: statusFromSmallint(existing.status) });
    }

    const [updated] = await db
      .update(tenant)
      .set(patch)
      .where(eq(tenant.id, id))
      .returning(tenantFields);
    if (!updated) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Tenant not found after update" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ...updated, status: statusFromSmallint(updated.status) });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    if ((e as { code?: string })?.code === "23505") {
      return NextResponse.json(
        { code: "CONFLICT", message: "Tenant key already exists" },
        { status: 409 },
      );
    }
    throw e;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { id } = await params;
    const existing = await getTenantById(id);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Tenant not found" },
        { status: 404 },
      );
    }
    await db.delete(tenant).where(eq(tenant.id, id));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
