import { NextResponse } from "next/server";
import * as apiKeyStore from "@/lib/api-key-store";

/** M04.F02 API Key 单条 CRUD + toggle */

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
  const k = apiKeyStore.getApiKey(id);
  if (!k) return NextResponse.json({ error: "api key not found" }, { status: 404 });
  return NextResponse.json(k);
}

export async function PATCH(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const k = apiKeyStore.toggleApiKey(id);
  if (!k) return NextResponse.json({ error: "api key not found" }, { status: 404 });
  return NextResponse.json(k);
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = parseId(params.id);
  if (id === null) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const ok = apiKeyStore.deleteApiKey(id);
  if (!ok) return NextResponse.json({ error: "api key not found" }, { status: 404 });
  return NextResponse.json({ deleted: true, id });
}