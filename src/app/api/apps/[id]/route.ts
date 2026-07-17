import { NextResponse } from "next/server";
import * as appStore from "@/lib/app-store";

/** M04.F01 应用单条 CRUD */

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
  const a = appStore.getApp(id);
  if (!a) return NextResponse.json({ error: "app not found" }, { status: 404 });
  return NextResponse.json(a);
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
    type?: unknown;
    description?: unknown;
    enabled?: unknown;
  };
  const patch: {
    name?: string;
    type?: string;
    description?: string;
    enabled?: boolean;
  } = {};
  if (typeof b.name === "string") patch.name = b.name;
  if (typeof b.type === "string") patch.type = b.type;
  if (typeof b.description === "string") patch.description = b.description;
  if (typeof b.enabled === "boolean") patch.enabled = b.enabled;
  const u = appStore.updateApp(id, patch);
  if (!u) return NextResponse.json({ error: "app not found" }, { status: 404 });
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
  const ok = appStore.deleteApp(id);
  if (!ok) return NextResponse.json({ error: "app not found" }, { status: 404 });
  return NextResponse.json({ deleted: true, id });
}