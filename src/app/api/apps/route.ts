import { NextResponse } from "next/server";
import * as appStore from "@/lib/app-store";

/** M04.F01.I12 应用 store actions 内部接口 — 应用 CRUD route handlers */

interface CreateAppBody {
  code?: unknown;
  name?: unknown;
  type?: unknown;
  description?: unknown;
  enabled?: unknown;
}

export async function GET() {
  return NextResponse.json(appStore.listApps());
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
  const b = raw as CreateAppBody;
  if (typeof b.code !== "string" || typeof b.name !== "string") {
    return NextResponse.json(
      { error: "missing required fields: code, name" },
      { status: 400 },
    );
  }
  const created = appStore.createApp({
    code: b.code,
    name: b.name,
    type: typeof b.type === "string" ? b.type : undefined,
    description: typeof b.description === "string" ? b.description : undefined,
    enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
  });
  return NextResponse.json(created, { status: 201 });
}