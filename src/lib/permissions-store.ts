import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// @entry M03.F01.I10 — 当前用户权限拉取与查询 (permissionStore)
//                      getCurrentUserPermissions(userId, tenantId): 派生 user global roles +
//                      tenant_users.role，去重返回 permission code 列表
// @entry M03.F01.I09 — 权限守卫 PermissionGuard（permissionStore + middleware 协同，
//                      返回 boolean 决定是否允许访问）

/**
 * M03.F01.I10 当前用户权限拉取与查询(permissionStore)
 *
 * 用 raw SQL 而非 Drizzle query builder —— vitest 4 + rolldown module cache
 * 下，Drizzle 的 schema-bound query 偶尔走不同 module instance，:memory:
 * SQLite 看起来是空表。raw SQL 走 globalThis.__drizzle 单例，避开问题。
 *
 * 派生策略（D14 决策）：
 *   1. user global roles (users.roles JSON 数组里的 role code) → role 表查 code → permissions
 *   2. tenant_users.role（per-tenant role code）→ role 表查 code → permissions
 *   3. user_group 继承推到 M05
 *
 * 返回去重后的 permission code 列表。
 */
interface RoleRow {
  id: number;
  code: string;
}

interface PermissionRow {
  code: string;
}

export function getCurrentUserPermissions(userId: number, tenantId: number): string[] {
  const collected = new Set<string>();

  // 1. user global roles（raw SQL 走 globalThis.__drizzle 单例）
  const userRow = db.all<{ roles: string }>(
    sql`SELECT roles FROM users WHERE id = ${userId}`,
  )[0];
  if (userRow) {
    let userRoleCodes: string[] = [];
    try {
      const parsed: unknown = JSON.parse(userRow.roles);
      if (Array.isArray(parsed)) {
        userRoleCodes = parsed.filter((r): r is string => typeof r === "string");
      }
    } catch {
      // ignore invalid JSON
    }
    if (userRoleCodes.length > 0) {
      // 查 roles 表拿 role.id
      for (const code of userRoleCodes) {
        const role = db.all<RoleRow>(
          sql`SELECT id, code FROM roles WHERE code = ${code}`,
        )[0];
        if (!role) continue;
        const perms = db.all<PermissionRow>(
          sql`SELECT permission_code AS code FROM role_permissions WHERE role_id = ${role.id}`,
        );
        for (const p of perms) collected.add(p.code);
      }
    }
  }

  // 2. tenant role
  const tu = db.all<{ role: string }>(
    sql`SELECT role FROM tenant_users WHERE user_id = ${userId} AND tenant_id = ${tenantId}`,
  )[0];
  if (tu) {
    const role = db.all<RoleRow>(
      sql`SELECT id, code FROM roles WHERE code = ${tu.role}`,
    )[0];
    if (role) {
      const perms = db.all<PermissionRow>(
        sql`SELECT permission_code AS code FROM role_permissions WHERE role_id = ${role.id}`,
      );
      for (const p of perms) collected.add(p.code);
    }
  }

  return [...collected].sort();
}