import { NextResponse } from "next/server";
import * as roleStore from "@/lib/role-store";

/** M03.F01.I07 — 角色菜单权限绑定 route handler */

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
  const role = roleStore.getRole(id);
  if (!role) return NextResponse.json({ error: "role not found" }, { status: 404 });
  const permissions = roleStore.getRolePermissions(id);
  return NextResponse.json({ roleId: id, permissions });
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
  roleStore.setRolePermissions(id, perms);
  return NextResponse.json({ roleId: id, permissions: perms });
}