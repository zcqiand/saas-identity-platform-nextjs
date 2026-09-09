// /api/v1/admin/apps/{appId}/menus - M08 菜单 list + create
//
// TypeSpec: tsp/routes/admin-app-menus.tsp
//   listMenus(@path appId): Menu[]   // 扁平数组，前端按 parentId 自构树
//   createMenu(@path appId, @body CreateMenuRequest): Menu
// appId path 参数接受 UUID 或 app code（前端传 code）。
//
// 2026-09-09 schema pivot：menus → sysMenu（列：clientId / title / type:smallint）。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { sysMenu } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";
import { resolveAppId } from "@/lib/app-resolver";

const CreateMenuBody = z.object({
  parentId: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(64),
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

function typeToSmallint(t: "group" | "page" | "action" | undefined): number {
  if (t === "group") return 1;
  if (t === "page") return 2;
  return 3; // action 或缺省
}

function statusFromSmallint(n: number): "active" | "disabled" {
  return n === 1 ? "active" : "disabled";
}

function typeFromSmallint(n: number): "group" | "page" | "action" {
  if (n === 1) return "group";
  if (n === 2) return "page";
  return "action";
}

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
      .insert(sysMenu)
      .values({
        clientId: appId,
        parentId: b.parentId ?? "00000000-0000-0000-0000-000000000000",
        title: b.title,
        path: b.path ?? null,
        icon: b.icon ?? null,
        type: typeToSmallint(b.type),
        sortOrder: b.sortOrder ?? 0,
        status: b.status === "disabled" ? 0 : 1,
      })
      .returning(menuFields);
    if (!created) {
      return NextResponse.json(
        { code: "INTERNAL", message: "Menu creation returned no row" },
        { status: 500 },
      );
    }
    return NextResponse.json({
      ...created,
      type: typeFromSmallint(created.type),
      status: statusFromSmallint(created.status),
    });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    if ((e as { code?: string })?.code === "23505") {
      return NextResponse.json(
        { code: "CONFLICT", message: "Menu conflict" },
        { status: 409 },
      );
    }
    throw e;
  }
}
