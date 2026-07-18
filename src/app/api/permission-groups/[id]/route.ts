import { NextResponse } from "next/server";
import * as permGroupStore from "@/lib/permission-group-store";

/** M03.F02 权限组单条 CRUD */

function parseId(id: string): number | null {
  const n = Number(id);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function parsePerms(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((p): p is string => typeof p === "string");
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const g = permGroupStore.getPermissionGroup(id);
  if (!g)
    return NextResponse.json({ error: "permission group not found" }, { status: 404 });
  return NextResponse.json(g);
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
    description?: unknown;
    permissions?: unknown;
    sort?: unknown;
    enabled?: unknown;
  };
  const patch: {
    name?: string;
    description?: string;
    permissions?: string[];
    sort?: number;
    enabled?: boolean;
  } = {};
  if (typeof b.name === "string") patch.name = b.name;
  if (typeof b.description === "string") patch.description = b.description;
  if (Array.isArray(b.permissions)) patch.permissions = parsePerms(b.permissions);
  if (typeof b.sort === "number") patch.sort = b.sort;
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  try {
    const u = permGroupStore.updatePermissionGroup(id, patch);
    if (!u)
      return NextResponse.json({ error: "permission group not found" }, { status: 404 });
    return NextResponse.json(u);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "update failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const ok = permGroupStore.deletePermissionGroup(id);
  if (!ok)
    return NextResponse.json({ error: "permission group not found" }, { status: 404 });
  return NextResponse.json({ deleted: true, id });
}