import { NextResponse } from "next/server";
import * as menuStore from "@/lib/menu-store";

/** M04.F01 应用菜单 CRUD route handlers */

interface CreateMenuBody {
  appId?: unknown;
  code?: unknown;
  name?: unknown;
  path?: unknown;
  parentId?: unknown;
  sort?: unknown;
  enabled?: unknown;
}

export async function GET(req?: Request) {
  if (req) {
    const u = new URL(req.url);
    const appIdStr = u.searchParams.get("appId");
    if (appIdStr) {
      const appId = Number(appIdStr);
      if (Number.isInteger(appId) && appId > 0) {
        return NextResponse.json(menuStore.listMenusByApp(appId));
      }
    }
  }
  return NextResponse.json(menuStore.listMenus());
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (raw === null || typeof raw !== "object") {
    return NextResponse.json({ error: "body must be object" }, { status: 400 });
  }
  const b = raw as CreateMenuBody;
  if (
    typeof b.appId !== "number" ||
    typeof b.code !== "string" ||
    typeof b.name !== "string" ||
    typeof b.path !== "string"
  ) {
    return NextResponse.json(
      { error: "missing required fields: appId, code, name, path" },
      { status: 400 },
    );
  }
  const created = menuStore.createMenu({
    appId: b.appId,
    code: b.code,
    name: b.name,
    path: b.path,
    parentId: b.parentId === undefined || b.parentId === null ? undefined : (b.parentId as number),
    sort: typeof b.sort === "number" ? b.sort : undefined,
    enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
  });
  return NextResponse.json(created, { status: 201 });
}