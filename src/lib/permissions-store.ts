import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";

// @entry M03.F01.I10 — 当前用户权限拉取与查询 (permissionStore)
//                      getCurrentUserPermissions(userId, tenantId): 派生 user global roles，
//                      去重返回 permission code 列表
// @entry M03.F01.I09 — 权限守卫 PermissionGuard（permissionStore + middleware 协同，
//                      返回 boolean 决定是否允许访问）

/**
 * M03.F01.I10 当前用户权限拉取与查询(permissionStore)
 *
 * 用 raw SQL 而非 Drizzle query builder —— 历史 vitest 4 + rolldown module cache
 * 问题已在迁移到 pg 后消失，但保留 raw SQL 形态以减少噪音；现走 db.execute(sql)
 * 拿 PG 结果行（结果类型用 as 断言，因为 db.execute 的泛型约束 Record<string, unknown>
 * 与具名 interface 不兼容）。
 *
 * 派生策略（D14 决策，M2-B 起）：
 *   1. user global roles (users.roles PG text[] 数组) → role 表查 code → permissions
 *   2. user_group 继承推到 M05
 *   3. ~~tenant_users.role（per-tenant role code）~~：v0.4.1 起 manifest 删除
 *      tenant_users 表，per-tenant 角色信息走 users.roles + app_menus 派生
 *
 * 返回去重后的 permission code 列表。
 *
 * v0.3.0：userId/tenantId 改 text（PK 改 text 字符串）；users.roles 从 JSON 字符串
 * 改为 PG text[] 原生数组，不再 JSON.parse。
 */
interface RoleRow {
  id: string;
  code: string;
}

interface PermissionRow {
  code: string;
}

// v0.4.1 起 tenant_users 表已删；保留 tenantId 参数以兼容既有调用面（middleware
// 仍透传），但当前派生只走 users.roles。等 per-tenant role 信息再次来源（v0.5.x）
// 后，tenantId 会重新参与 SQL 查询。
export async function getCurrentUserPermissions(userId: string, _tenantId: string): Promise<string[]> {
  void _tenantId;
  const collected = new Set<string>();

  // 1. user global roles —— v0.3.0：roles 为 PG text[]，node-pg 已解析为 string[]
  const userResult = await db.execute(sql`SELECT roles FROM users WHERE id = ${userId}`);
  const userRow = (userResult.rows[0] as { roles: string[] } | undefined) ?? undefined;
  if (userRow) {
    const userRoleCodes: string[] = Array.isArray(userRow.roles)
      ? userRow.roles.filter((r): r is string => typeof r === "string")
      : [];
    if (userRoleCodes.length > 0) {
      // 查 roles 表拿 role.id
      for (const code of userRoleCodes) {
        const roleResult = await db.execute(sql`SELECT id, code FROM roles WHERE code = ${code}`);
        const role = roleResult.rows[0] as RoleRow | undefined;
        if (!role) continue;
        const permsResult = await db.execute(
          sql`SELECT permission_code AS code FROM role_permissions WHERE role_id = ${role.id}`,
        );
        for (const p of permsResult.rows as unknown as PermissionRow[]) collected.add(p.code);
      }
    }
  }

  // 2. tenant role —— v0.4.1 起 tenant_users 表已删；per-tenant 权限通过 users.roles 派生

  return [...collected].sort();
}