import "server-only";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { appMenus, type AppMenu, type NewAppMenu } from "@/db/schema";

/** M04.F01 — 应用菜单 store（CRUD + 树形） */

export interface MenuTreeNode extends AppMenu {
  depth: number;
}

export function listMenus(): AppMenu[] {
  return db.select().from(appMenus).all();
}

export function listMenusByApp(appId: number): AppMenu[] {
  return db.select().from(appMenus).where(eq(appMenus.appId, appId)).all();
}

export function getMenu(id: number): AppMenu | null {
  return db.select().from(appMenus).where(eq(appMenus.id, id)).get() ?? null;
}

export function createMenu(input: {
  appId: number;
  code: string;
  name: string;
  path: string;
  parentId?: number | null;
  sort?: number;
  enabled?: boolean;
}): AppMenu {
  return db
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
    .returning()
    .get();
}

export function updateMenu(
  id: number,
  patch: Partial<Pick<NewAppMenu, "name" | "path" | "parentId" | "sort" | "enabled">>,
): AppMenu | null {
  const existing = getMenu(id);
  if (!existing) return null;
  const merged: NewAppMenu = {
    ...existing,
    name: patch.name ?? existing.name,
    path: patch.path ?? existing.path,
    parentId: patch.parentId === undefined ? existing.parentId : patch.parentId,
    sort: patch.sort ?? existing.sort,
    enabled: patch.enabled ?? existing.enabled,
  };
  db.update(appMenus)
    .set({
      name: merged.name,
      path: merged.path,
      parentId: merged.parentId,
      sort: merged.sort,
      enabled: merged.enabled,
    })
    .where(eq(appMenus.id, id))
    .run();
  return getMenu(id);
}

export function deleteMenu(id: number): boolean {
  const result = db.delete(appMenus).where(eq(appMenus.id, id)).run();
  return result.changes > 0;
}

export function getMenuTree(appId: number): MenuTreeNode[] {
  return db.all<MenuTreeNode>(sql`
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
}