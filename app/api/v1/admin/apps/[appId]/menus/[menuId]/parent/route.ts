// /api/v1/admin/apps/{appId}/menus/{menuId}/parent - M08.F02.I07 切换父级（moveTo）
//
// TypeSpec: tsp/routes/admin-app-menus.tsp
//   moveMenu(@path appId, @path menuId, @body { parentId?: string }): Menu
// parentId 为 null/undefined 表示移到顶级。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { menus } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const MoveBody = z.object({
  parentId: z.string().uuid().optional().nullable(),
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

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string; menuId: string }> },
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
      return NextResponse.json(
        { code: "NOT_FOUND", message: "Menu not found" },
        { status: 404 },
      );
    }
    const [updated] = await db
      .update(menus)
      .set({ parentId: parsed.data.parentId ?? null })
      .where(eq(menus.id, menuId))
      .returning(menuFields);
    return NextResponse.json(updated);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
