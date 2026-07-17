import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { rolePermissions, roles, type NewRole, type Role } from "@/db/schema";

// @entry M03.F01.I08 — 角色 store actions 内部接口（listRoles / createRole /
//                      updateRole / deleteRole / getRolePermissions / setRolePermissions / roleHasPermission）
// @entry M03.F02.I05 — 权限组 store actions 内部接口（同文件，role_permissions 关联操作）
// @entry M03.F03.I05 — 用户组 store actions 内部接口（listRoles 用于跨组权限推导，待 M05）

/** M03.F01.I08 — 角色 store（CRUD + role_permissions 关联） */

export function listRoles(): Role[] {
  return db.select().from(roles).all();
}

export function getRole(id: number): Role | null {
  return db.select().from(roles).where(eq(roles.id, id)).get() ?? null;
}

export function createRole(input: {
  code: string;
  name: string;
  description?: string;
  enabled?: boolean;
}): Role {
  return db
    .insert(roles)
    .values({
      code: input.code,
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? true,
    })
    .returning()
    .get();
}

export function updateRole(
  id: number,
  patch: { name?: string; description?: string; enabled?: boolean },
): Role | null {
  const existing = getRole(id);
  if (!existing) return null;
  const merged: NewRole = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    enabled: patch.enabled ?? existing.enabled,
  };
  db.update(roles)
    .set({ name: merged.name, description: merged.description, enabled: merged.enabled })
    .where(eq(roles.id, id))
    .run();
  return getRole(id);
}

export function deleteRole(id: number): boolean {
  const result = db.delete(roles).where(eq(roles.id, id)).run();
  return result.changes > 0;
}

export function getRolePermissions(roleId: number): string[] {
  return db
    .select({ code: rolePermissions.permissionCode })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId))
    .all()
    .map((r) => r.code);
}

/** D18 决策：setRoleMenuPermissions 占位 MVP；UI 留 M04 */
export function setRolePermissions(roleId: number, perms: string[]): void {
  // CASCADE 删旧的
  db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId)).run();
  for (const code of perms) {
    db.insert(rolePermissions).values({ roleId, permissionCode: code }).run();
  }
}

/** D17 决策：错误清理：role_store 内部 error state */
let lastError: string | null = null;
export function getLastError(): string | null {
  return lastError;
}
export function clearErrors(): void {
  lastError = null;
}

// 验证 roleId 存在（用于 D14 auth-store 集成）
export function roleHasPermission(roleId: number, code: string): boolean {
  return db
    .select()
    .from(rolePermissions)
    .where(
      and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionCode, code)),
    )
    .get()
    ? true
    : false;
}