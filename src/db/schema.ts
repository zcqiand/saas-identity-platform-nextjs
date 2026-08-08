/**
 * PostgreSQL schema（drizzle pg-core） —— 单一来源：shared 仓 codegen 输出。
 *
 * v0.4.x 起：所有 pgTable 由 `tables/manifest.json` 经 `emit:ts` 生成。
 * 本文件仅做 re-export + camelCase 别名，方便 nextjs 业务侧继续按 camelCase 名引用。
 *
 * 包暴露路径：@saas/identity-platform-shared/codegen/db.pg
 *
 * 命名约定（manifest → 生成器 → Drizzle）：
 *   - 表名：snake_case（如 `tenant_users`、`menu_templates` —— manifest v0.4.1 已删除）
 *   - 列名：snake_case（DB 真名）
 *   - TS 字段名：camelCase（如 `tenantId`）
 *   - 类型名：单数 PascalCase（如 `Tenant`、`User`）
 *
 * 旧手写 schema 残留已由 commit 84b399a 合并为基线，M2-B 起切换到 barrel。
 */

// 走 file: protocol 直接拷 barrel 到本仓 src/db/generated，避免 shared 仓无 drizzle-orm 依赖
// 时 tsc 无法在 file: 子目录里 resolve `drizzle-orm/pg-core`。
// 同步方式：`npm run sync:db-pg` 或 `node ../saas-identity-platform-shared/scripts/codegen/emit-ts.ts > src/db/generated/db.pg.ts`。
// generated 路径在 .gitignore 中，commit 时不参与 diff。
export * from "./generated/db.pg";

import * as generated from "./generated/db.pg";

// 历史 camelCase 别名 → 生成器 snake_case（业务侧引用面稳定）
export const healthCheck = generated.health_check;
export const ssoStates = generated.sso_states;
export const userGroups = generated.user_groups;
export const userGroupMembers = generated.user_group_members;
export const permissionGroups = generated.permission_groups;
export const appMenus = generated.app_menus;
export const apiKeys = generated.api_keys;
export const auditLogs = generated.audit_logs;
export const platformSettings = generated.platform_settings;
export const tokenConfig = generated.token_config;
export const loginSecurity = generated.login_security;
export const passwordPolicy = generated.password_policy;
export const riskControl = generated.risk_control;
export const notificationConfig = generated.notification_config;
export const openPlatformConfig = generated.open_platform_config;
export const oauthScopes = generated.oauth_scopes;
export const loginMethods = generated.login_methods;
export const ssoProviders = generated.sso_providers;
export const oauth2Providers = generated.oauth2_providers;
export const roleMenuPermissions = generated.role_menu_permissions;
export const rolePermissions = generated.role_permissions;