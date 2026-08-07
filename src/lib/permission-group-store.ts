import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  permissionGroups,
  type NewPermissionGroup,
  type PermissionGroup,
} from "@/db/schema";

/** M03.F02 权限组（permission_groups）store 接口 — v0.3.0：appId required + permissions/menuIds 原生数组 */

export async function listPermissionGroups(): Promise<PermissionGroup[]> {
  return db.select().from(permissionGroups);
}

export async function getPermissionGroup(id: string): Promise<PermissionGroup | null> {
  const [row] = await db
    .select()
    .from(permissionGroups)
    .where(eq(permissionGroups.id, id));
  return row ?? null;
}

export async function createPermissionGroup(
  input: Omit<NewPermissionGroup, "createdAt" | "updatedAt">,
): Promise<PermissionGroup> {
  const [row] = await db.insert(permissionGroups).values(input).returning();
  return row!;
}

export async function updatePermissionGroup(
  id: string,
  patch: {
    appId?: string;
    name?: string;
    description?: string;
    permissions?: string[];
    menuIds?: string[];
    sort?: number;
    enabled?: boolean;
  },
): Promise<PermissionGroup | null> {
  const existing = await getPermissionGroup(id);
  if (!existing) return null;
  const merged: NewPermissionGroup = {
    ...existing,
    appId: patch.appId ?? existing.appId,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    permissions: patch.permissions ?? existing.permissions,
    menuIds: patch.menuIds ?? existing.menuIds,
    sort: patch.sort ?? existing.sort,
    enabled: patch.enabled ?? existing.enabled,
  };
  await db.update(permissionGroups)
    .set({
      appId: merged.appId,
      name: merged.name,
      description: merged.description,
      permissions: merged.permissions,
      menuIds: merged.menuIds,
      sort: merged.sort,
      enabled: merged.enabled,
    })
    .where(eq(permissionGroups.id, id));
  return getPermissionGroup(id);
}

export async function deletePermissionGroup(id: string): Promise<boolean> {
  const result = await db
    .delete(permissionGroups)
    .where(eq(permissionGroups.id, id));
  return (result.rowCount ?? 0) > 0;
}
