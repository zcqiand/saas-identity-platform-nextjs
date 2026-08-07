import { NextResponse } from "next/server";
import * as permGroupStore from "@/lib/permission-group-store";

/** M03.F02 权限组 CRUD route handlers */

interface CreateBody {
  id?: unknown;
  appId?: unknown;
  name?: unknown;
  description?: unknown;
  permissions?: unknown;
  menuIds?: unknown;
  sort?: unknown;
  enabled?: unknown;
}

function parseStrings(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter((p): p is string => typeof p === "string");
}

export async function GET() {
  return NextResponse.json(await permGroupStore.listPermissionGroups());
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
  const b = raw as CreateBody;
  if (
    typeof b.id !== "string" ||
    typeof b.appId !== "string" ||
    typeof b.name !== "string" ||
    !b.name.trim()
  ) {
    return NextResponse.json(
      { error: "missing required fields: id, appId, name" },
      { status: 400 },
    );
  }
  try {
    const created = await permGroupStore.createPermissionGroup({
      id: b.id,
      appId: b.appId,
      name: b.name.trim(),
      description: typeof b.description === "string" ? b.description : undefined,
      permissions: parseStrings(b.permissions),
      menuIds: parseStrings(b.menuIds),
      sort: typeof b.sort === "number" ? b.sort : undefined,
      enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "create failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}