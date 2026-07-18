import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { orgs, type NewOrg, type Org } from "@/db/schema";

/** M02.F01.I07 — 组织管理 store（CRUD + 树形） */

/** 树节点：扁平 + depth 字段（render 端按 depth 缩进即可） */
export interface OrgTreeNode extends Org {
  depth: number;
}

/** M02.F01.I07 — 错误清理：store 内部 error state */
let lastError: string | null = null;

export function getLastError(): string | null {
  return lastError;
}

export function clearErrors(): void {
  lastError = null;
}

export function listOrgs(): Org[] {
  return db.select().from(orgs).all();
}

export function getOrg(id: number): Org | null {
  return db.select().from(orgs).where(eq(orgs.id, id)).get() ?? null;
}

export function createOrg(input: Omit<NewOrg, "id" | "createdAt" | "updatedAt">): Org {
  return db.insert(orgs).values(input).returning().get();
}

export function updateOrg(
  id: number,
  patch: Partial<Pick<NewOrg, "name" | "parentId" | "sort" | "enabled">>,
): Org | null {
  const existing = getOrg(id);
  if (!existing) return null;
  const merged: NewOrg = { ...existing, ...patch };
  db.update(orgs)
    .set({
      name: merged.name,
      parentId: merged.parentId,
      sort: merged.sort,
      enabled: merged.enabled,
    })
    .where(eq(orgs.id, id))
    .run();
  return getOrg(id);
}

export function deleteOrg(id: number): boolean {
  const result = db.delete(orgs).where(eq(orgs.id, id)).run();
  return result.changes > 0;
}

/** SQLite 递归 CTE 一次查全树 */
export function getOrgTree(): OrgTreeNode[] {
  return db.all<OrgTreeNode>(sql`
    WITH RECURSIVE org_tree(id, name, parent_id, sort, enabled, created_at, updated_at, depth) AS (
      SELECT id, name, parent_id, sort, enabled, created_at, updated_at, 0
      FROM orgs
      WHERE parent_id IS NULL
      UNION ALL
      SELECT o.id, o.name, o.parent_id, o.sort, o.enabled, o.created_at, o.updated_at, t.depth + 1
      FROM orgs o JOIN org_tree t ON o.parent_id = t.id
    )
    SELECT id, name, parent_id AS "parentId", sort, enabled,
           created_at AS "createdAt", updated_at AS "updatedAt", depth
    FROM org_tree
    ORDER BY depth, sort, name
  `);
}