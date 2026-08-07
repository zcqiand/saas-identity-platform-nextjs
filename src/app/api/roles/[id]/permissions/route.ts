import { NextResponse } from "next/server";
import * as roleStore from "@/lib/role-store";

/** M03.F01.I07 — 角色菜单权限绑定 route handler */

export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id;
  if (!id) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const role = await roleStore.getRole(id);
  if (!role) return NextResponse.json({ error: "role not found" }, { status: 404 });
  const permissions = await roleStore.getRolePermissions(id);
  return NextResponse.json({ roleId: id, permissions });
}

export async function PUT(
  req: Request,
  { params }: { params: { id: string } },
) {
  const id = params.id;
  if (!id) {
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
  const b = raw as { permissions?: unknown };
  if (!Array.isArray(b.permissions)) {
    return NextResponse.json(
      { error: "missing required field: permissions (string[])" },
      { status: 400 },
    );
  }
  const perms = (b.permissions as unknown[]).filter(
    (p): p is string => typeof p === "string",
  );
  await roleStore.setRolePermissions(id, perms);
  return NextResponse.json({ roleId: id, permissions: perms });
}