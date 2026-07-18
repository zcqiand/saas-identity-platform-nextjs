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

/** M02.F01.I09 + 全部模块 — 测试用 seed（全量 11 表 + 4 关联表） */

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

export function seedDatabase(): void {
  // Wipe in FK-safe order
  db.delete(apiKeys).run();
  db.delete(appMenus).run();
  db.delete(apps).run();
  db.delete(rolePermissions).run();
  db.delete(roles).run();
  db.delete(orgs).run();
  db.delete(positions).run();
  db.delete(userGroups).run();
  db.delete(users).run();
  db.delete(tenants).run();
  db.delete(auditLogs).run();
  db.delete(platformSettings).run();

  // Insert in FK-safe order
  for (const t of TENANT_SEED) db.insert(tenants).values(t).run();
  for (const u of USER_SEED) db.insert(users).values(u).run();
  for (const o of ORG_SEED) db.insert(orgs).values(o).run();
  for (const p of POSITION_SEED) db.insert(positions).values(p).run();
  for (const r of ROLE_SEED) db.insert(roles).values(r).run();
  for (const rp of ROLE_PERMISSION_SEED) {
    const roleRow = db.select().from(roles).all().find((x) => x.code === rp.roleCode);
    if (roleRow) db.insert(rolePermissions).values({ roleId: roleRow.id, permissionCode: rp.permissionCode }).run();
  }
  for (const g of USER_GROUP_SEED) db.insert(userGroups).values(g).run();
  for (const a of APP_SEED) db.insert(apps).values(a).run();
  for (const m of APP_MENU_SEED) {
    const appRow = db.select().from(apps).all().find((x) => x.code === m.appCode);
    if (appRow) db.insert(appMenus).values({ appId: appRow.id, code: m.code, name: m.name, path: m.path, parentId: null, sort: m.sort, enabled: m.enabled }).run();
  }
  for (const k of API_KEY_SEED) {
    const appRow = db.select().from(apps).all().find((x) => x.code === k.appCode);
    if (appRow) db.insert(apiKeys).values({ name: k.name, key: k.key, appId: appRow.id, expiresAt: "never", enabled: k.enabled }).run();
  }
  for (const s of PLATFORM_SETTING_SEED) db.insert(platformSettings).values(s).run();
}