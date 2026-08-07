import { NextResponse } from "next/server";
import * as menuStore from "@/lib/menu-store";

/** M04.F01 应用菜单 CRUD route handlers */

interface CreateMenuBody {
  id?: unknown;
  appId?: unknown;
  code?: unknown;
  name?: unknown;
  path?: unknown;
  parentId?: unknown;
  icon?: unknown;
  permission?: unknown;
  sort?: unknown;
  enabled?: unknown;
}

export async function GET(req?: Request) {
  if (req) {
    const u = new URL(req.url);
    const appId = u.searchParams.get("appId");
    if (appId) {
      return NextResponse.json(await menuStore.listMenusByApp(appId));
    }
  }
  return NextResponse.json(await menuStore.listMenus());
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
    typeof b.id !== "string" ||
    typeof b.appId !== "string" ||
    typeof b.name !== "string" ||
    typeof b.path !== "string"
  ) {
    return NextResponse.json(
      { error: "missing required fields: id, appId, name, path" },
      { status: 400 },
    );
  }
  const created = await menuStore.createMenu({
    id: b.id,
    appId: b.appId,
    // code 是 notNull 但无默认值：调用方不给时用 id 兜底
    code: typeof b.code === "string" ? b.code : b.id,
    name: b.name,
    path: b.path,
    parentId: typeof b.parentId === "string" ? b.parentId : null,
    icon: typeof b.icon === "string" ? b.icon : undefined,
    permission: typeof b.permission === "string" ? b.permission : undefined,
    sort: typeof b.sort === "number" ? b.sort : undefined,
    enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
  });
  return NextResponse.json(created, { status: 201 });
}