// /api/v1/tenants/:tenantId/roles — M02.F01 CRUD
//
// TypeSpec: tsp/routes/tenant-roles.tsp
// - listRoles(@query page?, @query pageSize?): Page<Role>
// - createRole(@body body: CreateRoleRequest): Role
// GET / POST
//
// 2026-09-09 schema pivot：roles → sysRole（列：tenantId / clientId / roleCode / roleName / description / isPreset / status:smallint）。
// 2026-09-10 响应对齐 SSOT SysRole：roleCode/roleName（去掉旧 code/name 平铺与
// permissionIds 幻字段 — permissions 域 b749c18 已废弃）。

import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { sysRole } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const CreateRoleBody = z.object({
  clientId: z.string().min(1).max(128),
  roleCode: z.string().min(1).max(64),
  roleName: z.string().min(1).max(64),
  description: z.string().max(255).optional(),
  isPreset: z.boolean().optional(),
});

function statusFromSmallint(n: number): number {
  return n;
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
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sysRole)
      .where(eq(sysRole.tenantId, tenantId));
    const total = totalResult[0]?.count ?? 0;
    const items = await db
      .select()
      .from(sysRole)
      .where(eq(sysRole.tenantId, tenantId))
      .limit(pageSize)
      .offset(page * pageSize)
      // 2026-09-12 四方 live 修复（roles list 排序）：msw oracle 是插入序（created_at ASC），
      // 此前 DESC 让 normalize 后第 5 行起与 oracle 分叉；显式 asc, id asc 对齐。
      .orderBy(sql`created_at asc, id asc`);
    return NextResponse.json({
      items: items.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        clientId: r.clientId,
        roleCode: r.roleCode,
        roleName: r.roleName,
        description: r.description ?? undefined,
        isPreset: r.isPreset,
        status: statusFromSmallint(r.status),
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      })),
      page,
      pageSize,
      total,
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
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
    const parsed = CreateRoleBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const inserted = await db
      .insert(sysRole)
      .values({
        tenantId,
        clientId: parsed.data.clientId,
        roleCode: parsed.data.roleCode,
        roleName: parsed.data.roleName,
        description: parsed.data.description ?? null,
        isPreset: parsed.data.isPreset ?? false,
        status: 1,
      })
      .returning();
    const r = inserted[0];
    if (!r) {
      return NextResponse.json(
        { code: "INTERNAL", message: "Insert returned no row" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      id: r.id,
      tenantId: r.tenantId,
      clientId: r.clientId,
      roleCode: r.roleCode,
      roleName: r.roleName,
      description: r.description ?? undefined,
      isPreset: r.isPreset,
      status: r.status,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}
