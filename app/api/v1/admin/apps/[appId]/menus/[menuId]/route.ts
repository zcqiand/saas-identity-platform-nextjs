// /api/v1/admin/apps/{appId}/menus/{menuId} - M08 单个菜单 get + update + delete
//
// TypeSpec: tsp/routes/admin-app-menus.tsp
//   getMenu(@path appId, @path menuId): Menu
//   updateMenu(@path appId, @path menuId, @body UpdateMenuRequest): Menu
//   deleteMenu(@path appId, @path menuId): void (204)
// DELETE 级联清子菜单（parent_id ON DELETE CASCADE）。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { menus } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const UpdateMenuBody = z.object({
  parentId: z.string().uuid().optional().nullable(),
  name: z.string().min(2).max(255).optional(),
  path: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  type: z.enum(["group", "page", "action"]).optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

const menuFields = {
  id: menus.id,
  appId: menus.appId,
  parentId: menus.parentId,
  code: menus.code,
  name: menus.name,
  path: menus.path,
  icon: menus.icon,
  type: menus.type,
  sortOrder: menus.sortOrder,
  status: menus.status,
  createdAt: menus.createdAt,
  updatedAt: menus.updatedAt,
};

async function getMenuById(id: string) {
  const rows = await db.select(menuFields).from(menus).where(eq(menus.id, id)).limit(1);
  return rows[0];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string; menuId: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { menuId } = await params;
    const menu = await getMenuById(menuId);
    if (!menu) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Menu not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(menu);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string; menuId: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { menuId } = await params;
    const parsed = UpdateMenuBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const existing = await getMenuById(menuId);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Menu not found" },
        { status: 404 },
      );
    }
    const { parentId, name, path, icon, type, sortOrder, status } = parsed.data;
    const patch: Record<string, unknown> = {};
    if (parentId !== undefined) patch.parentId = parentId ?? null;
    if (name !== undefined) patch.name = name;
    if (path !== undefined) patch.path = path ?? null;
    if (icon !== undefined) patch.icon = icon ?? null;
    if (type !== undefined) patch.type = type;
    if (sortOrder !== undefined) patch.sortOrder = sortOrder;
    if (status !== undefined) patch.status = status;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(existing);
    }
    const [updated] = await db
      .update(menus)
      .set(patch)
      .where(eq(menus.id, menuId))
      .returning(menuFields);
    return NextResponse.json(updated);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string; menuId: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { menuId } = await params;
    const existing = await getMenuById(menuId);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Menu not found" },
        { status: 404 },
      );
    }
    await db.delete(menus).where(eq(menus.id, menuId));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
