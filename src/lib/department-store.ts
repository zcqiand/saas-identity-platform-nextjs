/**
 * M02.F01 部门 store（drizzle pgTable → shared Department 命名对齐）
 *
 * v0.3.0 重命名（原 org → department）：
 *   - OrgTreeNode → DepartmentTreeNode
 *   - getOrg/createOrg/updateOrg/deleteOrg/getOrgTree → Department* 版本
 *   - underlying pgTable v0.3.0 重命名为 "departments"（orgs → departments）
 *   - PK 从 serial 改 text；tenantId required
 *
 * 类型 / 导入面：以 Department 暴露，对应 shared/schemas/department.ts。
 */
import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { departments, type NewDepartment, type Department } from "@/db/schema";

/** 树节点：扁平 + depth 字段（render 端按 depth 缩进即可） */
export interface DepartmentTreeNode extends Department {
  depth: number;
}

let lastError: string | null = null;

export function getLastError(): string | null {
  return lastError;
}

export function clearErrors(): void {
  lastError = null;
}

export async function listDepartments(): Promise<Department[]> {
  return db.select().from(departments);
}

export async function getDepartment(id: string): Promise<Department | null> {
  const [row] = await db.select().from(departments).where(eq(departments.id, id));
  return row ?? null;
}

export async function createDepartment(
  input: Omit<NewDepartment, "createdAt" | "updatedAt">,
): Promise<Department> {
  const [row] = await db.insert(departments).values(input).returning();
  return row!;
}

export async function updateDepartment(
  id: string,
  patch: Partial<Pick<NewDepartment, "name" | "parentId" | "sort" | "enabled">>,
): Promise<Department | null> {
  const existing = await getDepartment(id);
  if (!existing) return null;
  const merged: NewDepartment = { ...existing, ...patch };
  await db
    .update(departments)
    .set({
      name: merged.name,
      parentId: merged.parentId,
      sort: merged.sort,
      enabled: merged.enabled,
    })
    .where(eq(departments.id, id));
  return getDepartment(id);
}

export async function deleteDepartment(id: string): Promise<boolean> {
  const result = await db.delete(departments).where(eq(departments.id, id));
  return (result.rowCount ?? 0) > 0;
}

/** 递归 CTE：用 db.execute 跑原生 SQL，一次查全树。列别名 camelCase。 */
export async function getDepartmentTree(): Promise<DepartmentTreeNode[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE org_tree(id, name, parent_id, sort, enabled, created_at, updated_at, depth) AS (
      SELECT id, name, parent_id, sort, enabled, created_at, updated_at, 0
      FROM departments
      WHERE parent_id IS NULL
      UNION ALL
      SELECT o.id, o.name, o.parent_id, o.sort, o.enabled, o.created_at, o.updated_at, t.depth + 1
      FROM departments o JOIN org_tree t ON o.parent_id = t.id
    )
    SELECT id, name, parent_id AS "parentId", sort, enabled,
           created_at AS "createdAt", updated_at AS "updatedAt", depth
    FROM org_tree
    ORDER BY depth, sort, name
  `);
  return result.rows as unknown as DepartmentTreeNode[];
}