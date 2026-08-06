import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { rolePermissions, roles, type NewRole, type Role } from "@/db/schema";

// @entry M03.F01.I08 — 角色 store actions 内部接口（listRoles / createRole /
//                      updateRole / deleteRole / getRolePermissions / setRolePermissions / roleHasPermission）
// @entry M03.F02.I05 — 权限组 store actions 内部接口（同文件，role_permissions 关联操作）
// @entry M03.F03.I05 — 用户组 store actions 内部接口（listRoles 用于跨组权限推导，待 M05）

/** M03.F01.I08 — 角色 store（CRUD + role_permissions 关联） */

export async function listRoles(): Promise<Role[]> {
  return db.select().from(roles);
}

export async function getRole(id: number): Promise<Role | null> {
  const [row] = await db.select().from(roles).where(eq(roles.id, id));
  return row ?? null;
}

export async function createRole(input: {
  code: string;
  name: string;
  description?: string;
  enabled?: boolean;
}): Promise<Role> {
  const [row] = await db
    .insert(roles)
    .values({
      code: input.code,
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? true,
    })
    .returning();
  return row!;
}

export async function updateRole(
  id: number,
  patch: { name?: string; description?: string; enabled?: boolean },
): Promise<Role | null> {
  const existing = await getRole(id);
  if (!existing) return null;
  const merged: NewRole = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    enabled: patch.enabled ?? existing.enabled,
  };
  await db.update(roles)
    .set({ name: merged.name, description: merged.description, enabled: merged.enabled })
    .where(eq(roles.id, id));
  return getRole(id);
}

export async function deleteRole(id: number): Promise<boolean> {
  const result = await db.delete(roles).where(eq(roles.id, id));
  return (result.rowCount ?? 0) > 0;
}

export async function getRolePermissions(roleId: number): Promise<string[]> {
  const rows = await db
    .select({ code: rolePermissions.permissionCode })
    .from(rolePermissions)
    .where(eq(rolePermissions.roleId, roleId));
  return rows.map((r) => r.code);
}

/** D18 决策：setRoleMenuPermissions 占位 MVP；UI 留 M04 */
export async function setRolePermissions(roleId: number, perms: string[]): Promise<void> {
  // CASCADE 删旧的
  await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
  for (const code of perms) {
    await db.insert(rolePermissions).values({ roleId, permissionCode: code });
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
export async function roleHasPermission(roleId: number, code: string): Promise<boolean> {
  const [row] = await db
    .select()
    .from(rolePermissions)
    .where(
      and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionCode, code)),
    );
  return row ? true : false;
}
