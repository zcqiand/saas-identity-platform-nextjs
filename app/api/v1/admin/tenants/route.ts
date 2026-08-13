// /api/v1/admin/tenants - M00.F01 平台级租户管理（list + create）
//
// TypeSpec: tsp/routes/admin-tenants.tsp
//   listTenants(@query page?, @query pageSize?): Page<Tenant>
//   createTenant(@body CreateTenantRequest): Tenant
// 语义：
//   - 平台级（不 tenant-scoped）：verifyPathTenant(null) 只要 JWT 存在即可
//   - GET -> Page<Tenant>（分页，created_at DESC）
//   - POST -> Tenant；code 平台唯一，冲突返 409

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { tenants } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const PAGE_DEFAULT = 20;
const PAGE_MAX = 100;

const CreateTenantBody = z.object({
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    verifyPathTenant(null, req.headers.get("authorization"));
    const url = new URL(req.url);
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const pageSize = Math.min(
      PAGE_MAX,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? PAGE_DEFAULT)),
    );

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenants);
    const total = totalResult[0]?.count ?? 0;

    const items = await db
      .select(tenantFields)
      .from(tenants)
      .limit(pageSize)
      .offset(page * pageSize)
      .orderBy(sql`created_at DESC`);

    return NextResponse.json({ items, page, pageSize, total });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    verifyPathTenant(null, req.headers.get("authorization"));
    const parsed = CreateTenantBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { code, name, status, settings } = parsed.data;
    const [created] = await db
      .insert(tenants)
      .values({
        code,
        name,
        status: status ?? "active",
        ...(settings ? { settings } : {}),
      })
      .returning(tenantFields);
    return NextResponse.json(created);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    // PG unique_violation（code 重复）
    if ((e as { code?: string })?.code === "23505") {
      return NextResponse.json(
        { code: "CONFLICT", message: "Tenant code already exists" },
        { status: 409 },
      );
    }
    throw e;
  }
}
