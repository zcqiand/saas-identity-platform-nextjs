// /api/v1/admin/clients/{clientId}/menus - M08 菜单 list + create
//
// TypeSpec: tsp/routes/client-menus.tsp
//   listMenus(@path clientId): Menu[]   // 扁平数组，前端按 parentId 自构树
//   createMenu(@path clientId, @body CreateMenuRequest): Menu
// clientId path 参数接受 UUID 或 app code（前端传 code）。
//
// 2026-09-09 schema pivot：menus → sysMenu（列：clientId / title / type:smallint）。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, asc } from "drizzle-orm";
import { db } from "@/db";
import { sysMenu } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";
import { resolveClientRow } from "@/lib/client-resolver";

const CreateMenuBody = z.object({
  parentId: z.string().uuid().optional().nullable(),
  title: z.string().min(2).max(64),
  path: z.string().optional().nullable(),
  icon: z.string().optional().nullable(),
  // SSOT SysMenuType（shared openapi）：directory | menu | button
  type: z.enum(["directory", "menu", "button"]).optional(),
  sortOrder: z.number().int().optional(),
  status: z.union([z.literal(0), z.literal(1), z.enum(["active", "disabled"])]).optional(),
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

function typeToSmallint(t: "directory" | "menu" | "button" | undefined): number {
  if (t === "directory") return 1;
  if (t === "menu") return 2;
  return 3; // button 或缺省
}

// status 落库归一化：数字/字符串别名统一转 smallint；响应透传数字（契约对齐 msw oracle）
function statusToSmallint(s: number | "active" | "disabled"): number {
  if (typeof s === "number") return s;
  return s === "active" ? 1 : 0;
}

function typeFromSmallint(n: number): "directory" | "menu" | "button" {
  if (n === 1) return "directory";
  if (n === 2) return "menu";
  return "button";
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { clientId: clientIdParam } = await params;
    // sys_menu.client_id 存 code 形态值 —— 用解析行的 client_id 列值查询
    const resolved = await resolveClientRow(clientIdParam);
    if (!resolved) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "App not found" },
        { status: 404 },
      );
    }
    const clientId = resolved.clientId;
    const items = await db
      .select(menuFields)
      .from(sysMenu)
      .where(eq(sysMenu.clientId, clientId))
      .orderBy(asc(sysMenu.sortOrder), asc(sysMenu.title));
    return NextResponse.json(
      items.map((m) => ({
        ...m,
        type: typeFromSmallint(m.type),
        status: m.status,
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
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { clientId: clientIdParam } = await params;
    const resolved = await resolveClientRow(clientIdParam);
    if (!resolved) {
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
        clientId: resolved.clientId,
        parentId: b.parentId ?? "00000000-0000-0000-0000-000000000000",
        title: b.title,
        path: b.path ?? null,
        icon: b.icon ?? null,
        type: typeToSmallint(b.type),
        sortOrder: b.sortOrder ?? 0,
        status: b.status === undefined ? 1 : statusToSmallint(b.status),
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
      status: created.status,
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
