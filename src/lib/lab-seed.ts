/**
 * M03.F02 身份集成 - lab 业务数据种子（v0.3.0 改写为 shared 派生）
 *
 * 改写前：本文件硬编码 LAB_TENANT / LAB_ORG_ROOT / LAB_USERS / LAB_ROLES / LAB_MENUS
 *        / LAB_PERMISSION_CODES 等 mock 数据。
 * 改写后：直接 re-export shared/seeds 的派生 helper（labTenant / labUsers / labRoles /
 *        labMenus / labPermissionCodes）以及常量别名（APP_LAB_ID / LAB_TENANT_ID /
 *        LAB_DEPARTMENT_ROOT_ID），保持本仓历史调用方不变（仅追加 export 即可兼容）。
 *
 * 与 saas-React 仓 msw/db.ts 对齐：lab 数据已上提为顶层租户维度（tenant-lab），无独立
 * lab 子目录。
 *
 * 不再放：原 hardcoded 22 项菜单数组——菜单来自 shared APP_MENUS（appId='app-lab'），
 * 包含「资源管理 / 实验过程管理 / 统计报表 / 检测能力 / 基础数据」5 分组 + 仪表盘顶级
 * + 21 叶。
 */

import {
  APP_LAB_ID,
  LAB_TENANT_ID,
  LAB_DEPARTMENT_ROOT_ID,
  // v0.3.0 兼容：旧名 LAB_ORG_ROOT_ID = LAB_DEPARTMENT_ROOT_ID（重命名）
  LAB_ORG_ROOT_ID,
  labTenant,
  labUsers,
  labRoles,
  labMenus,
  labPermissionCodes,
} from "@saas/identity-platform-shared/seeds";

export {
  APP_LAB_ID,
  LAB_TENANT_ID,
  LAB_DEPARTMENT_ROOT_ID,
  LAB_ORG_ROOT_ID,
  labTenant,
  labUsers,
  labRoles,
  labMenus,
  labPermissionCodes,
};

/* ─────────────────────────────────────────────────────────────────────────── */
/* v0.3.0 兼容别名（保持历史调用方不变）                                        */
/* ─────────────────────────────────────────────────────────────────────────── */

/**
 * 旧 LAB_TENANT 调用方（route /api/auth/oauth/callback 等）若需整张对象，从
 * labTenant()（shared helper）派生。本处不再硬编码。
 */
export const LAB_TENANT = (() => {
  const t = labTenant();
  if (!t) throw new Error("shared/seeds: lab tenant not found (id=tenant-lab)");
  // 旧字段名（id/name/theme/logoText）按需转换：theme 字符串/对象由消费方 isTenantThemeString guard
  return {
    id: t.id,
    name: t.name,
    theme: typeof t.theme === "string" ? t.theme : "#2563eb",
    logoText: t.id === "tenant-lab" ? "LAB" : t.id.toUpperCase(),
  };
})();

/**
 * 旧 LAB_ORG_ROOT 调用方（同上）— LAB_DEPARTMENT_ROOT_ID 即对应。
 */
export const LAB_ORG_ROOT = {
  id: LAB_DEPARTMENT_ROOT_ID,
  name: "示例建筑工程检测实验室",
  tenantId: LAB_TENANT_ID,
} as const;

/**
 * v0.3.0 兼容：旧 `LabUser` / `LabRole` / `LabMenu` 类型调用方（如路由 / api handlers）。
 * 新代码请直接用 shared 导出的 `User` / `Role` / `Menu` 类型。
 */
export interface LabUser {
  id: string;
  username: string;
  displayName: string;
  /** v0.3.0 重命名：orgId → departmentId（旧调用方仍兼容用 orgId，但底层取自 shared LabUser.departmentId） */
  orgId: string;
  tenantId: string;
  roleId: string;
}

export interface LabRole {
  id: string;
  name: string;
  description: string;
  permissions: readonly string[];
}

export interface LabMenu {
  id: string;
  name: string;
  path: string;
  appId: string;
  parentId: string | null;
  sort: number;
  enabled: boolean;
  permission?: string;
}

/**
 * 旧 LAB_USERS 调用方（如 route.ts）按 username 找 user。v0.3.0 改为派生自 shared
 * `labUsers()`：取 tenant-lab 的 USERS 行。user.roleId 取第一个 role（shared
 * UserSchema.roles 是数组）。
 */
export const LAB_USERS: readonly LabUser[] = labUsers().map((u) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  orgId: u.departmentId ?? LAB_DEPARTMENT_ROOT_ID,
  tenantId: u.tenantId,
  roleId: u.roles[0] ?? "role-lab-admin",
}));

/**
 * 旧 LAB_ROLES 调用方：派生自 shared `labRoles()`（tenantId='tenant-lab'）。
 * permissions 取自 shared Role.permissions[]。
 */
export const LAB_ROLES: readonly LabRole[] = labRoles().map((r) => ({
  id: r.id,
  name: r.name,
  description: r.description ?? "",
  permissions: r.permissions,
}));

/**
 * 旧 LAB_MENUS 调用方：派生自 shared `labMenus()`（appId='app-lab'）。
 * 旧字段 `permission` 由 shared Menu.permission 派生；shared menu 无此字段时省略。
 */
export const LAB_MENUS: readonly LabMenu[] = labMenus().map((m) => ({
  id: m.id,
  name: m.name,
  path: m.path,
  appId: m.appId,
  parentId: m.parentId ?? null,
  sort: m.sort,
  enabled: m.enabled,
  ...(m.permission ? { permission: m.permission } : {}),
}));

/**
 * 旧 LAB_PERMISSION_CODES 调用方：派生自 shared `labPermissionCodes()`（OAUTH_SCOPES
 * 的 id 列表，app-lab）。
 */
export const LAB_PERMISSION_CODES: readonly string[] = labPermissionCodes();