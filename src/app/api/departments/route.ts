import { NextResponse } from "next/server";
import * as departmentStore from "@/lib/department-store";

/** M02.F01 部门 CRUD route handlers
 *
 * v0.3.0 重命名（原 /api/orgs → /api/departments）。
 */

interface CreateDepartmentBody {
  name?: unknown;
  parentId?: unknown;
  sort?: unknown;
  enabled?: unknown;
}

export async function GET() {
  return NextResponse.json(await departmentStore.listDepartments());
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
  const b = raw as CreateDepartmentBody;
  if (typeof b.name !== "string") {
    return NextResponse.json({ error: "missing required field: name" }, { status: 400 });
  }
  const created = await departmentStore.createDepartment({
    name: b.name,
    parentId: b.parentId === null || b.parentId === undefined ? null : Number(b.parentId),
    sort: typeof b.sort === "number" ? b.sort : 0,
    enabled: typeof b.enabled === "boolean" ? b.enabled : true,
  });
  return NextResponse.json(created, { status: 201 });
}