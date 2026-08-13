// /api/v1/admin/tenants/glm_5.2_ark_toC - M00.F01 单个租户（get + update + delete）
//
// TypeSpec: tsp/routes/admin-tenants.tsp
//   getTenant(@path id): Tenant
//   updateTenant(@path id, @body UpdateTenantRequest): Tenant
//   deleteTenant(@path id): void (204)
// 语义：
//   - 平台级（不 tenant-scoped）：verifyPathTenant(null) 只要 JWT
//   - DELETE 级联清 users / memberships / roles 等（FK ON DELETE CASCADE）

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const UpdateTenantBody = z.object({
  name: z.string().min(2).max(255).optional(),
  code: z.string().min(2).max(64).optional(),
  status: z.enum(["active", "suspended", "archived"]).optional(),
  settings: z.record(z.unknown()).optional(),
});

const tenantFields = {
  id: tenants.id,
  code: tenants.code,
  name: tenants.name,
  status: tenants.status,
  settings: tenants.settings,
  createdAt: tenants.createdAt,
  updatedAt: tenants.updatedAt,
};

async function getTenantById(id: string) {
  const rows = await db
    .select(tenantFields)
    .from(tenants)
    .where(eq(tenants.id, id))
    .limit(1);
  return rows[0];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    verifyPathTenant(null, req.headers.get("authorization"));
    const { id } = await params;
    const tenant = await getTenantById(id);
    if (!tenant) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Tenant not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(tenant);
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
    verifyPathTenant(null, req.headers.get("authorization"));
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

    const { name, code, status, settings } = parsed.data;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (code !== undefined) patch.code = code;
    if (status !== undefined) patch.status = status;
    if (settings !== undefined) patch.settings = settings;

    // 空更新（body 全 undefined）直接回当前行，避免空 SET SQL
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(existing);
    }

    const [updated] = await db
      .update(tenants)
      .set(patch)
      .where(eq(tenants.id, id))
      .returning(tenantFields);
    return NextResponse.json(updated);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    if ((e as { code?: string })?.code === "23505") {
      return NextResponse.json(
        { code: "CONFLICT", message: "Tenant code already exists" },
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
    verifyPathTenant(null, req.headers.get("authorization"));
    const { id } = await params;
    const existing = await getTenantById(id);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Tenant not found" },
        { status: 404 },
      );
    }
    await db.delete(tenants).where(eq(tenants.id, id));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
