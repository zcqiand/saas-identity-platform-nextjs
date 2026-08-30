// /api/v1/tenants/:tenantId/roles — M02.F01 CRUD
//
// TypeSpec: tsp/routes/tenant-roles.tsp
// - listRoles(@query page?, @query pageSize?): Page<Role>
// - createRole(@body body: CreateRoleRequest): Role
// GET / POST
//
// 2026-08-30：contract-test M96.F02.I07/I08 字节对齐
// - 去 description 字段(msw 真后端不返); 加 permissionIds(join role_permissions → permissions.id)

import { NextRequest, NextResponse } from "next/server";
import { eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { roles, rolePermissions } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const CreateRoleBody = z.object({
  code: z.string().min(1).max(64),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  permissionIds: z.array(z.string().uuid()).optional(),
});

/** 批量取这些 role 的 permissionId UUID 列表(避免 N+1)。 */
async function permissionIdsForRoles(roleIds: readonly string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (roleIds.length === 0) return out;
  const rows = await db
    .select({ roleId: rolePermissions.roleId, permissionId: rolePermissions.permissionId })
    .from(rolePermissions)
    .where(inArray(rolePermissions.roleId, [...roleIds]));
  for (const r of rows) {
    const arr = out.get(r.roleId);
    if (arr) arr.push(r.permissionId);
    else out.set(r.roleId, [r.permissionId]);
  }
  return out;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const url = new URL(req.url);
    // OpenAPI 标准: page=0-indexed, pageSize 默认 20, 上限 100
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(roles)
      .where(eq(roles.tenantId, tenantId));
    const total = totalResult[0]?.count ?? 0;
    const items = await db
      .select()
      .from(roles)
      .where(eq(roles.tenantId, tenantId))
      .limit(pageSize)
      .offset(page * pageSize)
      .orderBy(sql`created_at DESC`);
    const perms = await permissionIdsForRoles(items.map((r) => r.id));
    return NextResponse.json({
      items: items.map((r) => ({
        id: r.id,
        tenantId: r.tenantId,
        code: r.code,
        name: r.name,
        permissionIds: perms.get(r.id) ?? [],
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
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
      .insert(roles)
      .values({
        tenantId,
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description,
      })
      .onConflictDoNothing({ target: [roles.tenantId, roles.code] })
      .returning();
    let r = inserted[0];
    if (!r) {
      const existing = await db
        .select()
        .from(roles)
        .where(eq(roles.tenantId, tenantId));
      const found = existing.find((x) => x.code === parsed.data.code);
      if (!found) {
        return NextResponse.json({ code: "CONFLICT", message: "Code exists" }, { status: 409 });
      }
      r = found;
    }
    return NextResponse.json({
      id: r.id,
      tenantId: r.tenantId,
      code: r.code,
      name: r.name,
      permissionIds: [], // 新建角色无 permission
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}