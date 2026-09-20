// /api/v1/admin/clients/{clientId}/menus/{menuId}/parent - M04.F04.I07 切换父级（moveTo）
//
// TypeSpec: tsp/routes/client-menus.tsp
//   moveMenu(@path clientId, @path menuId, @body { parentId?: string }): Menu
// parentId 为 null/undefined 表示移到顶级。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sysMenu } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const MoveBody = z.object({
  parentId: z.string().uuid().optional().nullable(),
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

function statusFromSmallint(n: number): "active" | "disabled" {
  return n === 1 ? "active" : "disabled";
}

function typeFromSmallint(n: number): "directory" | "menu" | "button" {
  if (n === 1) return "directory";
  if (n === 2) return "menu";
  return "button";
}

async function getMenuById(id: string) {
  const rows = await db.select(menuFields).from(sysMenu).where(eq(sysMenu.id, id)).limit(1);
  return rows[0];
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string; menuId: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { menuId } = await params;
    const parsed = MoveBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const existing = await getMenuById(menuId);
    if (!existing) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Menu not found" }, { status: 404 });
    }
    const [updated] = await db
      .update(sysMenu)
      .set({ parentId: parsed.data.parentId ?? "00000000-0000-0000-0000-000000000000" })
      .where(eq(sysMenu.id, menuId))
      .returning(menuFields);
    if (!updated) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Menu not found after update" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      ...updated,
      type: typeFromSmallint(updated.type),
      status: statusFromSmallint(updated.status),
    });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
