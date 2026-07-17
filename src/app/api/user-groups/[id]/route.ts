import { NextResponse } from "next/server";
import * as userGroupStore from "@/lib/user-group-store";

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
  const g = userGroupStore.getUserGroup(id);
  if (!g) return NextResponse.json({ error: "user group not found" }, { status: 404 });
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
  const b = raw as { name?: unknown; description?: unknown; enabled?: unknown };
  const patch: { name?: string; description?: string; enabled?: boolean } = {};
  if (typeof b.name === "string") patch.name = b.name;
  if (typeof b.description === "string") patch.description = b.description;
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  const g = userGroupStore.updateUserGroup(id, patch);
  if (!g) return NextResponse.json({ error: "user group not found" }, { status: 404 });
  return NextResponse.json(g);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const ok = userGroupStore.deleteUserGroup(id);
  if (!ok) return NextResponse.json({ error: "user group not found" }, { status: 404 });
  return NextResponse.json({ deleted: true, id });
}