// /api/v1/admin/apps/{appId}/menus/{menuId}/reorder - M04.F04.I06 同级排序
//
// TypeSpec: tsp/routes/admin-app-menus.tsp
//   reorderMenus(@path appId, @path menuId, @body ReorderMenuRequest): Menu[]
// body.orderedMenuIds：期望同级菜单按此顺序；服务端按数组下标写 sortOrder。
// 返回该 app 全部菜单（新顺序）。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { sysMenu } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";
import { resolveAppId } from "@/lib/app-resolver";

const ReorderBody = z.object({
  orderedMenuIds: z.array(z.string().uuid()),
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

function typeFromSmallint(n: number): "group" | "page" | "action" {
  if (n === 1) return "group";
  if (n === 2) return "page";
  return "action";
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string; menuId: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { appId: appIdParam } = await params;
    const appId = await resolveAppId(appIdParam);
    if (!appId) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "App not found" },
        { status: 404 },
      );
    }
    const parsed = ReorderBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { orderedMenuIds } = parsed.data;
    for (let i = 0; i < orderedMenuIds.length; i++) {
      await db
        .update(sysMenu)
        .set({ sortOrder: i })
        .where(eq(sysMenu.id, orderedMenuIds[i]));
    }
    const items = await db
      .select(menuFields)
      .from(sysMenu)
      .where(eq(sysMenu.clientId, appId))
      .orderBy(asc(sysMenu.sortOrder), asc(sysMenu.title));
    return NextResponse.json(
      items.map((m) => ({
        ...m,
        type: typeFromSmallint(m.type),
        status: statusFromSmallint(m.status),
      })),
    );
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
