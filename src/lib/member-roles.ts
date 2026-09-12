// member-roles — roleIds 真值链（2026-09-12 roleIds 恒空修复）
//
// 业务真值链：roleIds = tenant_member_role ⨝ sys_role。
// 之前 GET 侧三处硬编码 `roleIds: []`，PUT /members/{u}/roles 写库正确但读不回。
//
// 2026-09-12 四方对齐（/me、/me/tenants normalize 分叉）：不再按 sys_role.tenant_id
// 过滤 —— msw/aspnetcore/springboot 三个 oracle 都是 tenant_member_role 直接连接
// 回带 roleIds；seed 里本就存在跨租户域链接（alice 的 globex membership c...006 挂
// acme 的 member 角色 a...002），tenant 过滤会把合法行吞成 []。
//
// 注意：路由参数是 userId（sys_user.id），authoritative 关系挂在 tenant_member.id 上，
// 必须先换算（见 members/[userId]/roles/route.ts 的现有换算逻辑）。

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sysRole, tenantMember, tenantMemberRole } from "@/db/schema";

// ── member status 映射（ADR-0032 TenantMemberStatus 4 值 ↔ tenant_member.status smallint）
// 与 scripts/seed-db.mjs statusToSmallint 同源：1=active 2=invited 3=suspended 0=disabled
export const MEMBER_STATUS_TO_SMALLINT = {
  active: 1,
  invited: 2,
  suspended: 3,
  disabled: 0,
} as const;

export type MemberStatus = keyof typeof MEMBER_STATUS_TO_SMALLINT;

export function smallintToMemberStatus(n: number): MemberStatus {
  return n === 1 ? "active" : n === 2 ? "invited" : n === 3 ? "suspended" : "disabled";
}

/** userId（sys_user.id）→ tenant_member.id；找不到 membership 返回 null */
export async function findMemberIdByUser(tenantId: string, userId: string): Promise<string | null> {
  const rows = await db
    .select({ id: tenantMember.id })
    .from(tenantMember)
    .where(and(eq(tenantMember.tenantId, tenantId), eq(tenantMember.userId, userId)))
    .limit(1);
  return rows[0]?.id ?? null;
}

/** 单个 member 的 roleIds（sys_role.id；tenantId 仅兼容旧签名，不再参与过滤） */
export async function getMemberRoleIds(memberId: string, tenantId: string): Promise<string[]> {
  const map = await getMemberRoleIdsBatch([memberId], tenantId);
  return map.get(memberId) ?? [];
}

/** 批量版：一次查多个 member 的 roleIds，避免列表页 N+1。返回 Map<memberId, roleIds[]> */
export async function getMemberRoleIdsBatch(
  memberIds: string[],
  tenantId: string,
): Promise<Map<string, string[]>> {
  const map = new Map<string, string[]>();
  if (memberIds.length === 0) return map;
  const rows = await db
    .select({ memberId: tenantMemberRole.memberId, roleId: sysRole.id })
    .from(tenantMemberRole)
    .innerJoin(sysRole, eq(sysRole.id, tenantMemberRole.roleId))
    .where(inArray(tenantMemberRole.memberId, memberIds));
  for (const id of memberIds) map.set(id, []);
  for (const r of rows) map.get(r.memberId)?.push(r.roleId);
  return map;
}
