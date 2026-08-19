// /api/v1/admin/apps/{appId}/menus - M08 菜单 list + create
//
// TypeSpec: tsp/routes/admin-app-menus.tsp
//   listMenus(@path appId): Menu[]   // 扁平数组，前端按 parentId 自构树
//   createMenu(@path appId, @body CreateMenuRequest): Menu
// appId path 参数接受 UUID 或 app code（前端传 code）。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { menus } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";
import { resolveAppId } from "@/lib/app-resolver";

const CreateMenuBody = z.object({
  parentId: z.string().uuid().optional().nullable(),
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
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
    const items = await db
      .select(menuFields)
      .from(menus)
      .where(eq(menus.appId, appId))
      .orderBy(asc(menus.sortOrder), asc(menus.code));
    return NextResponse.json(items);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
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
    const parsed = CreateMenuBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const b = parsed.data;
    const [created] = await db
      .insert(menus)
      .values({
        appId,
        parentId: b.parentId ?? null,
        code: b.code,
        name: b.name,
        path: b.path ?? null,
        icon: b.icon ?? null,
        type: b.type ?? "page",
        sortOrder: b.sortOrder ?? 0,
        status: b.status ?? "active",
      })
      .returning(menuFields);
    return NextResponse.json(created);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    if ((e as { code?: string })?.code === "23505") {
      return NextResponse.json(
        { code: "CONFLICT", message: "Menu code already exists in this app" },
        { status: 409 },
      );
    }
    throw e;
  }
}
