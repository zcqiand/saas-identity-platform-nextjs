import { NextResponse } from "next/server";
import * as departmentStore from "@/lib/department-store";

/** M02.F01 部门 CRUD route handlers — by id
 *
 * v0.3.0 重命名（原 /api/orgs/[id] → /api/departments/[id]）。
 */

interface UpdateDepartmentBody {
  name?: unknown;
  parentId?: unknown;
  sort?: unknown;
  enabled?: unknown;
}

export async function PUT(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
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
  const b = raw as UpdateDepartmentBody;
  const updated = await departmentStore.updateDepartment(id, {
    name: typeof b.name === "string" ? b.name : undefined,
    parentId: b.parentId === null ? null : typeof b.parentId === "string" ? b.parentId : undefined,
    sort: typeof b.sort === "number" ? b.sort : undefined,
    enabled: typeof b.enabled === "boolean" ? b.enabled : undefined,
  });
  if (!updated) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!id) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const ok = await departmentStore.deleteDepartment(id);
  if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({ deleted: true });
}