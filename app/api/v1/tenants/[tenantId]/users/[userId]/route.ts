// /api/v1/tenants/:tenantId/users/:userId — M01.F01.I03 / M01.F01.I04 / M01.F01.I05
// 同路径支持 GET / PATCH / DELETE
//
// TypeSpec:
// - getUser(@path tenantId, @path userId): User
// - updateUser(@path tenantId, @path userId, @body body): User
// - deleteUser(@path tenantId, @path userId): void

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const UpdateUserBody = z.object({
  email: z.string().email().optional(),
  displayName: z.string().optional(),
  status: z.enum(["active", "invited", "suspended", "disabled"]).optional(),
  roleIds: z.array(z.string().uuid()).optional(),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; userId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, userId } = await params;
    verifyPathTenant(tenantId, req.headers.get("authorization"));
    const rows = await db
      .select()
      .from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .limit(1);
    const u = rows[0];
    if (!u) {
      return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: u.id,
      tenantId: u.tenantId,
      username: u.username,
      email: u.email,
      displayName: u.displayName ?? undefined,
      status: u.status,
      roleIds: (u.roleIds ?? []).map((r) => r),
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; userId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, userId } = await params;
    verifyPathTenant(tenantId, req.headers.get("authorization"));
    const parsed = UpdateUserBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.email !== undefined) patch.email = parsed.data.email;
    if (parsed.data.displayName !== undefined) patch.displayName = parsed.data.displayName;
    if (parsed.data.status !== undefined) patch.status = parsed.data.status;
    if (parsed.data.roleIds !== undefined) patch.roleIds = parsed.data.roleIds;
    const updated = await db
      .update(users)
      .set(patch)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)))
      .returning();
    const u = updated[0];
    if (!u) {
      return NextResponse.json({ code: "NOT_FOUND", message: "User not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: u.id,
      tenantId: u.tenantId,
      username: u.username,
      email: u.email,
      displayName: u.displayName ?? undefined,
      status: u.status,
      roleIds: (u.roleIds ?? []).map((r) => r),
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; userId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, userId } = await params;
    verifyPathTenant(tenantId, req.headers.get("authorization"));
    await db
      .delete(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}