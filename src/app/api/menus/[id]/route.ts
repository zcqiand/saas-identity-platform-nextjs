import { NextResponse } from "next/server";
import * as menuStore from "@/lib/menu-store";

/** M04.F01 菜单单条 CRUD */

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const m = menuStore.getMenu(id);
  if (!m) return NextResponse.json({ error: "menu not found" }, { status: 404 });
  return NextResponse.json(m);
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (raw === null || typeof raw !== "object") {
    return NextResponse.json({ error: "body must be object" }, { status: 400 });
  }
  const b = raw as {
    name?: unknown;
    path?: unknown;
    parentId?: unknown;
    sort?: unknown;
    enabled?: unknown;
  };
  const patch: {
    name?: string;
    path?: string;
    parentId?: number | null;
    sort?: number;
    enabled?: boolean;
  } = {};
  if (typeof b.name === "string") patch.name = b.name;
  if (typeof b.path === "string") patch.path = b.path;
  if (b.parentId === null) patch.parentId = null;
  else if (typeof b.parentId === "number") patch.parentId = b.parentId;
  if (typeof b.sort === "number") patch.sort = b.sort;
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  const u = menuStore.updateMenu(id, patch);
  if (!u) return NextResponse.json({ error: "menu not found" }, { status: 404 });
  return NextResponse.json(u);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const ok = menuStore.deleteMenu(id);
  if (!ok) return NextResponse.json({ error: "menu not found" }, { status: 404 });
  return NextResponse.json({ deleted: true, id });
}