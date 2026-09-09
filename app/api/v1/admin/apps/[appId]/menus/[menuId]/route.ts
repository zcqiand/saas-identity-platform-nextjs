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
import { sysMenu } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const UpdateMenuBody = z.object({
  parentId: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(64).optional(),
  path: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  type: z.enum(["group", "page", "action"]).optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["active", "disabled"]).optional(),
});

const menuFields = {
  id: sysMenu.id,
  clientId: sysMenu.clientId,
  parentId: sysMenu.parentId,
  title: sysMenu.title,
  type: sysMenu.type,
  path: sysMenu.path,
  component: sysMenu.component,
  perms: sysMenu.perms,
  icon: sysMenu.icon,
  sortOrder: sysMenu.sortOrder,
  status: sysMenu.status,
  createdAt: sysMenu.createdAt,
};

function typeToSmallint(t: "group" | "page" | "action"): number {
  if (t === "group") return 1;
  if (t === "page") return 2;
  return 3;
}

function statusFromSmallint(n: number): "active" | "disabled" {
  return n === 1 ? "active" : "disabled";
}

function typeFromSmallint(n: number): "group" | "page" | "action" {
  if (n === 1) return "group";
  if (n === 2) return "page";
  return "action";
}

async function getMenuById(id: string) {
  const rows = await db.select(menuFields).from(sysMenu).where(eq(sysMenu.id, id)).limit(1);
  return rows[0];
}

function toDto(m: Awaited<ReturnType<typeof getMenuById>>) {
  if (!m) return m;
  return {
    ...m,
    type: typeFromSmallint(m.type),
    status: statusFromSmallint(m.status),
  };
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
    return NextResponse.json(toDto(menu));
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
    const { parentId, title, path, icon, type, sortOrder, status } = parsed.data;
    const patch: Record<string, unknown> = {};
    if (parentId !== undefined) patch.parentId = parentId ?? "00000000-0000-0000-0000-000000000000";
    if (title !== undefined) patch.title = title;
    if (path !== undefined) patch.path = path ?? null;
    if (icon !== undefined) patch.icon = icon ?? null;
    if (type !== undefined) patch.type = typeToSmallint(type);
    if (sortOrder !== undefined) patch.sortOrder = sortOrder;
    if (status !== undefined) patch.status = status === "active" ? 1 : 0;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json(toDto(existing));
    }
    const [updated] = await db
      .update(sysMenu)
      .set(patch)
      .where(eq(sysMenu.id, menuId))
      .returning(menuFields);
    if (!updated) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Menu not found after update" },
        { status: 404 },
      );
    }
    return NextResponse.json(toDto(updated));
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
    await db.delete(sysMenu).where(eq(sysMenu.id, menuId));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
