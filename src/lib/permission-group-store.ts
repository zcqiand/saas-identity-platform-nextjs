import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  permissionGroups,
  type NewPermissionGroup,
  type PermissionGroup,
} from "@/db/schema";

/** M03.F02 权限组（permission_groups）store 接口 — name + permissions JSON 字符串数组 */

function parsePermissions(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    return [];
  }
}

function permissionsToJson(perms: string[]): string {
  return JSON.stringify(perms);
}

export async function listPermissionGroups(): Promise<PermissionGroup[]> {
  return db.select().from(permissionGroups);
}

export async function getPermissionGroup(id: number): Promise<PermissionGroup | null> {
  const [row] = await db
    .select()
    .from(permissionGroups)
    .where(eq(permissionGroups.id, id));
  return row ?? null;
}

export async function createPermissionGroup(input: {
  name: string;
  description?: string;
  permissions?: string[];
  sort?: number;
  enabled?: boolean;
}): Promise<PermissionGroup> {
  const [row] = await db
    .insert(permissionGroups)
    .values({
      name: input.name,
      description: input.description,
      permissions: permissionsToJson(input.permissions ?? []),
      sort: input.sort ?? 0,
      enabled: input.enabled ?? true,
    } satisfies NewPermissionGroup)
    .returning();
  return row!;
}

export async function updatePermissionGroup(
  id: number,
  patch: {
    name?: string;
    description?: string;
    permissions?: string[];
    sort?: number;
    enabled?: boolean;
  },
): Promise<PermissionGroup | null> {
  const existing = await getPermissionGroup(id);
  if (!existing) return null;
  const merged: NewPermissionGroup = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    permissions: patch.permissions
      ? permissionsToJson(patch.permissions)
      : existing.permissions,
    sort: patch.sort ?? existing.sort,
    enabled: patch.enabled ?? existing.enabled,
  };
  await db.update(permissionGroups)
    .set({
      name: merged.name,
      description: merged.description,
      permissions: merged.permissions,
      sort: merged.sort,
      enabled: merged.enabled,
    })
    .where(eq(permissionGroups.id, id));
  return getPermissionGroup(id);
}

export async function deletePermissionGroup(id: number): Promise<boolean> {
  const result = await db
    .delete(permissionGroups)
    .where(eq(permissionGroups.id, id));
  return (result.rowCount ?? 0) > 0;
}

// 工具：暴露 JSON ↔ array 的 parse 函数给 UI 端复用（UI 自己 import parsePermissions 即可）
export { parsePermissions };
