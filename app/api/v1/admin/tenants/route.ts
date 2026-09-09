// /api/v1/admin/tenants - M00.F01 平台级租户管理（list + create）
//
// TypeSpec: tsp/routes/admin-tenants.tsp
//   listTenants(@query page?, @query pageSize?): Page<Tenant>
//   createTenant(@body CreateTenantRequest): Tenant
// 语义：
//   - 平台级（不 tenant-scoped）：await verifyPathTenant(null) 只要 JWT 存在即可
//   - GET -> Page<Tenant>（分页，created_at DESC）
//   - POST -> Tenant；tenantKey 平台唯一，冲突返 409
//
// 2026-09-09 schema pivot：tenants → tenant（列：tenantKey / status:smallint）。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql, eq } from "drizzle-orm";
import { db } from "@/db";
import { tenant } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const PAGE_DEFAULT = 20;
const PAGE_MAX = 100;

const CreateTenantBody = z.object({
  tenantKey: z.string().min(2).max(64),
  name: z.string().min(2).max(128),
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

function statusToSmallint(s: "active" | "suspended" | undefined): number {
  if (s === "suspended") return 2;
  return 1; // active 或缺省
}

function statusFromSmallint(n: number): "active" | "suspended" {
  return n === 2 ? "suspended" : "active";
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const url = new URL(req.url);
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const pageSize = Math.min(
      PAGE_MAX,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? PAGE_DEFAULT)),
    );

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenant);
    const total = totalResult[0]?.count ?? 0;

    const items = await db
      .select(tenantFields)
      .from(tenant)
      .limit(pageSize)
      .offset(page * pageSize)
      .orderBy(sql`created_at DESC`);

    return NextResponse.json({
      items: items.map((t) => ({ ...t, status: statusFromSmallint(t.status) })),
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

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const parsed = CreateTenantBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { tenantKey, name, status } = parsed.data;
    const [created] = await db
      .insert(tenant)
      .values({
        tenantKey,
        name,
        status: statusToSmallint(status),
      })
      .returning(tenantFields);
    if (!created) {
      return NextResponse.json(
        { code: "INTERNAL", message: "Tenant creation returned no row" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ...created,
      status: statusFromSmallint(created.status),
    });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    // PG unique_violation（tenantKey 重复）
    if ((e as { code?: string })?.code === "23505") {
      return NextResponse.json(
        { code: "CONFLICT", message: "Tenant key already exists" },
        { status: 409 },
      );
    }
    throw e;
  }
}

// Suppress unused-import warning for eq (kept for future status filter)
void eq;
