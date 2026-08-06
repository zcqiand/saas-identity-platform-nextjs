import "server-only";
import { db } from "./index";
import {
  tenants,
  users,
  orgs,
  positions,
  roles,
  rolePermissions,
  userGroups,
  apps,
  appMenus,
  apiKeys,
  auditLogs,
  platformSettings,
} from "./schema";

/** M02.F01.I09 + 全部模块 — 测试用 seed（全量 11 表 + 4 关联表）
 *
 * 异步版（Task 4：db 句柄迁到 pg Pool 后所有 db.* 调用必须 await）。
 */

const TENANT_SEED = [
  { code: "acme", name: "Acme Corp", theme: "default" },
  { code: "globex", name: "Globex Inc", theme: "dark" },
  { code: "initech", name: "Initech LLC", theme: "light" },
] as const;

const USER_SEED = [
  { username: "alice", displayName: "Alice Admin", email: "alice@acme.com", roles: '["admin"]', status: "active" },
  { username: "bob", displayName: "Bob Manager", email: "bob@acme.com", roles: '["manager"]', status: "active" },
  { username: "carol", displayName: "Carol Member", email: "carol@acme.com", roles: '["member"]', status: "active" },
] as const;

const ORG_SEED = [
  { id: 1, name: "Acme 总公司", parentId: null, sort: 0, enabled: true },
  { id: 2, name: "技术中心", parentId: 1, sort: 0, enabled: true },
] as const;

const POSITION_SEED = [
  { code: "ceo", name: "CEO", description: null, sort: 1, enabled: true },
  { code: "eng", name: "Engineer", description: null, sort: 10, enabled: true },
] as const;

const ROLE_SEED = [
  { code: "admin", name: "Administrator", description: "All perms", enabled: true },
  { code: "manager", name: "Manager", description: null, enabled: true },
  { code: "member", name: "Member", description: null, enabled: true },
] as const;

const ROLE_PERMISSION_SEED = [
  { roleCode: "admin", permissionCode: "user:read" },
  { roleCode: "admin", permissionCode: "user:write" },
  { roleCode: "manager", permissionCode: "user:read" },
  { roleCode: "member", permissionCode: "user:read" },
];

const USER_GROUP_SEED = [
  { id: 1, name: "All Users", description: null, enabled: true },
] as const;

const APP_SEED = [
  { code: "dashboard", name: "数据看板", type: "web", description: null, enabled: true },
] as const;

const APP_MENU_SEED = [
  { appCode: "dashboard", code: "overview", name: "总览", path: "/dashboard", parentCode: null, sort: 0, enabled: true },
] as const;

const API_KEY_SEED = [
  { name: "ci-deploy", key: "abcdef1234567890abcdef1234567890", appCode: "dashboard", enabled: true },
] as const;

const PLATFORM_SETTING_SEED = [
  { key: "platform.name", value: "SaaS 统一身份管理", description: "平台名" },
  { key: "platform.copyright", value: "© 2026 Acme Corp", description: "版权" },
  { key: "password.min_length", value: "8", description: "最小密码长度" },
  { key: "token.access_ttl_sec", value: "3600", description: "access token TTL" },
];

export async function seedDatabase(): Promise<void> {
  // Wipe in FK-safe order
  await db.delete(apiKeys);
  await db.delete(appMenus);
  await db.delete(apps);
  await db.delete(rolePermissions);
  await db.delete(roles);
  await db.delete(orgs);
  await db.delete(positions);
  await db.delete(userGroups);
  await db.delete(users);
  await db.delete(tenants);
  await db.delete(auditLogs);
  await db.delete(platformSettings);

  // Insert in FK-safe order (parents first)
  for (const t of TENANT_SEED) await db.insert(tenants).values(t);
  for (const u of USER_SEED) await db.insert(users).values(u);
  for (const o of ORG_SEED) await db.insert(orgs).values(o);
  for (const p of POSITION_SEED) await db.insert(positions).values(p);
  for (const r of ROLE_SEED) await db.insert(roles).values(r);
  for (const rp of ROLE_PERMISSION_SEED) {
    const allRoles = await db.select().from(roles);
    const roleRow = allRoles.find((x) => x.code === rp.roleCode);
    if (roleRow) await db.insert(rolePermissions).values({ roleId: roleRow.id, permissionCode: rp.permissionCode });
  }
  for (const g of USER_GROUP_SEED) await db.insert(userGroups).values(g);
  for (const a of APP_SEED) await db.insert(apps).values(a);
  for (const m of APP_MENU_SEED) {
    const allApps = await db.select().from(apps);
    const appRow = allApps.find((x) => x.code === m.appCode);
    if (appRow) await db.insert(appMenus).values({ appId: appRow.id, code: m.code, name: m.name, path: m.path, parentId: null, sort: m.sort, enabled: m.enabled });
  }
  for (const k of API_KEY_SEED) {
    const allApps = await db.select().from(apps);
    const appRow = allApps.find((x) => x.code === k.appCode);
    if (appRow) await db.insert(apiKeys).values({ name: k.name, key: k.key, appId: appRow.id, expiresAt: "never", enabled: k.enabled });
  }
  for (const s of PLATFORM_SETTING_SEED) await db.insert(platformSettings).values(s);
}
