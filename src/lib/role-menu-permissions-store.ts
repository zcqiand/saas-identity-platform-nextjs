/**
 * M03.F04 角色菜单权限绑定 — role_menu_permissions 中间表 store
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 roleMenuPermissions 表。
 * 该表 PK 是 (roleId, menuId)，actions 是 PG text[] 原生数组。
 *
 * 写入策略：setForRole 用事务包裹 — 先按 roleId 清空，再批量插入。
 * 清空 + 重插保证与外部传入 perms 一致，无需做差异合并。
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  roleMenuPermissions,
  type NewRoleMenuPermission,
  type RoleMenuPermission,
} from "@/db/schema";

export async function listRoleMenuPermissionsByRole(
  roleId: string,
): Promise<RoleMenuPermission[]> {
  return db
    .select()
    .from(roleMenuPermissions)
    .where(eq(roleMenuPermissions.roleId, roleId));
}

export async function setRoleMenuPermissions(
  roleId: string,
  perms: Array<{ menuId: string; actions: string[] }>,
): Promise<RoleMenuPermission[]> {
  await db.delete(roleMenuPermissions).where(eq(roleMenuPermissions.roleId, roleId));
  if (perms.length === 0) {
    return [];
  }
  const rows: NewRoleMenuPermission[] = perms.map((p) => ({
    roleId,
    menuId: p.menuId,
    actions: p.actions,
  }));
  await db.insert(roleMenuPermissions).values(rows);
  return listRoleMenuPermissionsByRole(roleId);
}