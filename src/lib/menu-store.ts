import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appMenus, type AppMenu, type NewAppMenu } from "@/db/schema";

/** M04.F01 — 应用菜单 store（CRUD + 树形） */

export interface MenuTreeNode extends AppMenu {
  depth: number;
}

export async function listMenus(): Promise<AppMenu[]> {
  return db.select().from(appMenus);
}

export async function listMenusByApp(appId: number): Promise<AppMenu[]> {
  return db.select().from(appMenus).where(eq(appMenus.appId, appId));
}

export async function getMenu(id: number): Promise<AppMenu | null> {
  const [row] = await db.select().from(appMenus).where(eq(appMenus.id, id));
  return row ?? null;
}

export async function createMenu(input: {
  appId: number;
  code: string;
  name: string;
  path: string;
  parentId?: number | null;
  sort?: number;
  enabled?: boolean;
}): Promise<AppMenu> {
  const [row] = await db
    .insert(appMenus)
    .values({
      appId: input.appId,
      code: input.code,
      name: input.name,
      path: input.path,
      parentId: input.parentId ?? null,
      sort: input.sort ?? 0,
      enabled: input.enabled ?? true,
    } satisfies NewAppMenu)
    .returning();
  return row!;
}

export async function updateMenu(
  id: number,
  patch: Partial<Pick<NewAppMenu, "name" | "path" | "parentId" | "sort" | "enabled">>,
): Promise<AppMenu | null> {
  const existing = await getMenu(id);
  if (!existing) return null;
  const merged: NewAppMenu = {
    ...existing,
    name: patch.name ?? existing.name,
    path: patch.path ?? existing.path,
    parentId: patch.parentId === undefined ? existing.parentId : patch.parentId,
    sort: patch.sort ?? existing.sort,
    enabled: patch.enabled ?? existing.enabled,
  };
  await db.update(appMenus)
    .set({
      name: merged.name,
      path: merged.path,
      parentId: merged.parentId,
      sort: merged.sort,
      enabled: merged.enabled,
    })
    .where(eq(appMenus.id, id));
  return getMenu(id);
}

export async function deleteMenu(id: number): Promise<boolean> {
  await db.delete(appMenus).where(eq(appMenus.id, id));
  return true;
}

/** 递归 CTE：用 db.execute 跑原生 SQL，返回树形节点（depth 缩进用）。列别名 camelCase。 */
export async function getMenuTree(appId: number): Promise<MenuTreeNode[]> {
  const result = await db.execute(sql`
    WITH RECURSIVE menu_tree(id, app_id, parent_id, code, name, path, sort, enabled, created_at, updated_at, depth) AS (
      SELECT id, app_id, parent_id, code, name, path, sort, enabled, created_at, updated_at, 0
      FROM app_menus
      WHERE app_id = ${appId} AND parent_id IS NULL
      UNION ALL
      SELECT m.id, m.app_id, m.parent_id, m.code, m.name, m.path, m.sort, m.enabled, m.created_at, m.updated_at, t.depth + 1
      FROM app_menus m JOIN menu_tree t ON m.parent_id = t.id
    )
    SELECT id, app_id AS "appId", parent_id AS "parentId", code, name, path, sort, enabled,
           created_at AS "createdAt", updated_at AS "updatedAt", depth
    FROM menu_tree
    ORDER BY depth, sort, name
  `);
  return result.rows as unknown as MenuTreeNode[];
}
