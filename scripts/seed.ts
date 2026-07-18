/**
 * 给 dev.db 灌种子数据（完整 11 表版本）。
 *
 * 用法：
 *   npm run db:seed
 *
 * 这个脚本**不**走 src/db/index.ts（因为它有 `import "server-only"`，tsx 没有
 * next bundler 上下文会抛），而是自己开 better-sqlite3 + drizzle 直连 data/dev.db。
 *
 * 覆盖表：tenants / users / orgs / positions / roles / role_permissions /
 *        user_groups / apps / app_menus / api_keys / platform_settings /
 *        sso_states / audit_logs / tenant_users / position_members /
 *        user_group_members / health_check。
 * 11 + 4 张关联 + health_check + sso_states 全部一次性灌好。
 */

import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

type Schema = typeof schema;
type DbHandle = BetterSQLite3Database<Schema>;

const DB_PATH = process.env.DB_PATH ?? "data/dev.db";

function open(): DbHandle {
  const sqlite = new Database(DB_PATH);
  if (DB_PATH !== ":memory:") {
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
  }
  return drizzle(sqlite, { schema });
}

const db = open();

// ---------------------------------------------------------------------------
// seed fixtures
// ---------------------------------------------------------------------------

const TENANT_SEED = [
  { code: "acme", name: "Acme Corp", theme: "default" },
  { code: "globex", name: "Globex Inc", theme: "dark" },
  { code: "initech", name: "Initech LLC", theme: "light" },
] as const;

const USER_SEED = [
  { username: "alice", displayName: "Alice Admin", email: "alice@acme.com", roles: '["admin"]', status: "active" },
  { username: "bob", displayName: "Bob Manager", email: "bob@acme.com", roles: '["manager"]', status: "active" },
  { username: "carol", displayName: "Carol Member", email: "carol@acme.com", roles: '["member"]', status: "active" },
  { username: "dave", displayName: "Dave Viewer", email: "dave@acme.com", roles: '["viewer"]', status: "active" },
  { username: "eve", displayName: "Eve Pending", email: "eve@acme.com", roles: '["member"]', status: "pending" },
] as const;

const ORG_SEED = [
  // id 顺序：parent 必须先于 child
  { id: 1, name: "Acme 总公司", parentId: null, sort: 0, enabled: true },
  { id: 2, name: "技术中心", parentId: 1, sort: 0, enabled: true },
  { id: 3, name: "Web 组", parentId: 2, sort: 0, enabled: true },
  { id: 4, name: "运营中心", parentId: 1, sort: 1, enabled: true },
] as const;

const POSITION_SEED = [
  { code: "ceo", name: "CEO", description: "首席执行官", sort: 1, enabled: true },
  { code: "eng", name: "工程经理", description: null, sort: 10, enabled: true },
  { code: "qa", name: "QA", description: null, sort: 20, enabled: true },
] as const;

const ROLE_SEED = [
  { code: "admin", name: "Administrator", description: "All perms", enabled: true },
  { code: "manager", name: "Manager", description: null, enabled: true },
  { code: "member", name: "Member", description: null, enabled: true },
  { code: "viewer", name: "Viewer", description: null, enabled: true },
] as const;

// 给 admin 角色预置 4 个权限；manager 给 2 个；member/viewer 给 1 个
const ROLE_PERMISSION_SEED: Array<{ roleCode: string; permissionCode: string }> = [
  { roleCode: "admin", permissionCode: "user:read" },
  { roleCode: "admin", permissionCode: "user:write" },
  { roleCode: "admin", permissionCode: "role:read" },
  { roleCode: "admin", permissionCode: "role:write" },
  { roleCode: "manager", permissionCode: "user:read" },
  { roleCode: "manager", permissionCode: "user:write" },
  { roleCode: "member", permissionCode: "user:read" },
  { roleCode: "viewer", permissionCode: "user:read" },
];

const USER_GROUP_SEED = [
  { id: 1, name: "Engineering Team", description: "All eng", enabled: true },
  { id: 2, name: "All Users", description: null, enabled: true },
] as const;

const PERMISSION_GROUP_SEED = [
  {
    name: "admin-pack",
    description: "管理员全部权限",
    permissions: ["user:read", "user:write", "role:read", "role:write", "tenant:read", "tenant:write", "audit:read", "platform:admin"],
    sort: 0,
    enabled: true,
  },
  {
    name: "read-pack",
    description: "只读权限集合",
    permissions: ["user:read", "role:read", "tenant:read"],
    sort: 1,
    enabled: true,
  },
] as const;

const APP_SEED = [
  { code: "dashboard", name: "数据看板", type: "web", description: null, enabled: true },
  { code: "billing", name: "计费系统", type: "web", description: null, enabled: true },
] as const;

const APP_MENU_SEED = [
  // dashboard 的菜单
  { appCode: "dashboard", code: "overview", name: "总览", path: "/dashboard", parentCode: null, sort: 0, enabled: true },
  { appCode: "dashboard", code: "metrics", name: "指标", path: "/dashboard/metrics", parentCode: "overview", sort: 0, enabled: true },
  { appCode: "dashboard", code: "alerts", name: "告警", path: "/dashboard/alerts", parentCode: "overview", sort: 1, enabled: true },
  // billing 的菜单
  { appCode: "billing", code: "invoices", name: "账单", path: "/billing/invoices", parentCode: null, sort: 0, enabled: true },
] as const;

const API_KEY_SEED = [
  { name: "ci-deploy", key: "abcdef1234567890abcdef1234567890", appCode: "dashboard", expiresAt: "never", enabled: true },
  { name: "metric-bot", key: "00000000000000000000000000000000", appCode: "billing", expiresAt: "never", enabled: true },
] as const;

const SSO_STATE_SEED = [
  { state: "seed-state-1", expiresAt: "2099-12-31 23:59:59" },
  { state: "seed-state-2", expiresAt: "2099-12-31 23:59:59" },
] as const;

const AUDIT_LOG_SEED: Array<{ action: string; operator: string; resource: string; resourceId: string; detail: string; ip: string; timestamp: string }> = (() => {
  const now = Date.now();
  const day = 86_400_000;
  const iso = (offsetDays: number) => new Date(now - offsetDays * day).toISOString();
  return [
    { action: "login", operator: "alice", resource: "auth", resourceId: "alice", detail: "登录成功", ip: "192.168.1.10", timestamp: iso(0) },
    { action: "login", operator: "bob", resource: "auth", resourceId: "bob", detail: "登录成功", ip: "192.168.1.11", timestamp: iso(0) },
    { action: "create", operator: "alice", resource: "tenant", resourceId: "acme", detail: "新建租户 acme", ip: "192.168.1.10", timestamp: iso(1) },
    { action: "update", operator: "alice", resource: "user", resourceId: "carol", detail: "更新 carol roles", ip: "192.168.1.10", timestamp: iso(2) },
    { action: "permission_change", operator: "alice", resource: "role", resourceId: "admin", detail: "调整 admin 权限", ip: "192.168.1.10", timestamp: iso(3) },
    { action: "delete", operator: "alice", resource: "api_key", resourceId: "ak_test_rw_002", detail: "删除 API Key", ip: "192.168.1.10", timestamp: iso(4) },
  ];
})();

const PLATFORM_SETTING_SEED = [
  // 安全策略
  { key: "security.ip_whitelist", value: "[]", description: "IP 白名单" },
  { key: "security.ip_blacklist", value: "[]", description: "IP 黑名单" },
  { key: "security.lockout_enabled", value: "true", description: "启用登录失败锁定" },
  { key: "security.lockout_threshold", value: "5", description: "锁定阈值" },
  { key: "security.lockout_duration_min", value: "30", description: "锁定时长（分钟）" },
  { key: "security.region_lock_enabled", value: "false", description: "启用地区限制" },
  { key: "security.allowed_regions", value: "[]", description: "允许地区" },
  // 登录方式
  { key: "login_method.password_enabled", value: "true", description: "密码登录启用" },
  { key: "login_method.sso_enabled", value: "true", description: "SSO 启用" },
  { key: "login_method.oauth2_enabled", value: "true", description: "OAuth2 启用" },
  // 密码策略
  { key: "password.enabled", value: "true", description: "启用密码策略" },
  { key: "password.min_length", value: "8", description: "最小长度" },
  { key: "password.require_uppercase", value: "true", description: "需大写" },
  { key: "password.require_lowercase", value: "true", description: "需小写" },
  { key: "password.require_digit", value: "true", description: "需数字" },
  { key: "password.require_special", value: "false", description: "需特殊字符" },
  { key: "password.expiry_days", value: "90", description: "过期天数" },
  { key: "password.history_count", value: "5", description: "历史密码数量" },
  // Token
  { key: "token.access_ttl_sec", value: "3600", description: "access token TTL 秒" },
  { key: "token.refresh_ttl_sec", value: "2592000", description: "refresh token TTL 秒" },
  { key: "token.rotate_on_refresh", value: "true", description: "refresh 时轮换" },
  // 通知
  { key: "notify.email_enabled", value: "true", description: "邮件通知" },
  { key: "notify.sms_enabled", value: "false", description: "短信通知" },
  { key: "notify.webhook_enabled", value: "true", description: "Webhook 通知" },
  { key: "notify.event_user_invite", value: "true", description: "用户邀请事件" },
  { key: "notify.event_password_change", value: "true", description: "密码变更事件" },
  { key: "notify.event_permission_change", value: "true", description: "权限变更事件" },
  // 开放 API
  { key: "openapi.enabled", value: "true", description: "开放 API 启用" },
  { key: "openapi.rate_limit_per_min", value: "600", description: "每分钟限流" },
  { key: "openapi.require_signature", value: "true", description: "强制签名" },
  // 风险
  { key: "risk.max_failed_logins", value: "5", description: "风险：最大失败登录" },
  { key: "risk.suspicious_ip_alert", value: "true", description: "可疑 IP 告警" },
  { key: "risk.unusual_time_alert", value: "true", description: "非常规时间告警" },
  { key: "risk.geo_anomaly_alert", value: "false", description: "地理异常告警" },
  // 平台
  { key: "platform.name", value: "SaaS 统一身份管理", description: "平台名" },
  { key: "platform.copyright", value: "© 2026 Acme Corp", description: "版权" },
  { key: "platform.support_email", value: "support@acme.com", description: "支持邮箱" },
  { key: "platform.privacy_url", value: "https://acme.com/privacy", description: "隐私政策链接" },
  { key: "platform.terms_url", value: "https://acme.com/terms", description: "服务条款链接" },
  { key: "platform.maintenance_mode", value: "false", description: "维护模式" },
  { key: "platform.announcement", value: "", description: "平台公告" },
] as const;

// ---------------------------------------------------------------------------
// Wipe in FK-safe order (children first)
// ---------------------------------------------------------------------------

db.delete(schema.userGroupMembers).run();
db.delete(schema.userGroups).run();
db.delete(schema.positionMembers).run();
db.delete(schema.positions).run();
db.delete(schema.rolePermissions).run();
db.delete(schema.roles).run();
db.delete(schema.permissionGroups).run();
db.delete(schema.orgs).run();
db.delete(schema.tenantUsers).run();
db.delete(schema.users).run();
db.delete(schema.appMenus).run();
db.delete(schema.apps).run();
db.delete(schema.apiKeys).run();
db.delete(schema.auditLogs).run();
db.delete(schema.platformSettings).run();
db.delete(schema.ssoStates).run();
db.delete(schema.tenants).run();

// ---------------------------------------------------------------------------
// Insert in FK-safe order (parents first)
// ---------------------------------------------------------------------------

for (const t of TENANT_SEED) db.insert(schema.tenants).values(t).run();
for (const u of USER_SEED) db.insert(schema.users).values(u).run();

// 给每个 user 配 tenant_users 关联（默认 acme + member）
for (const u of USER_SEED) {
  const userRow = db.select().from(schema.users).where(eq(schema.users.username, u.username)).get();
  const tenantRow = db.select().from(schema.tenants).where(eq(schema.tenants.code, "acme")).get();
  if (userRow && tenantRow) {
    db.insert(schema.tenantUsers).values({ tenantId: tenantRow.id, userId: userRow.id, role: u.username === "alice" ? "admin" : "member" }).run();
  }
}

for (const o of ORG_SEED) db.insert(schema.orgs).values(o).run();
for (const p of POSITION_SEED) db.insert(schema.positions).values(p).run();
for (const r of ROLE_SEED) db.insert(schema.roles).values(r).run();

// role_permissions 需要 role.id
for (const rp of ROLE_PERMISSION_SEED) {
  const roleRow = db.select().from(schema.roles).where(eq(schema.roles.code, rp.roleCode)).get();
  if (roleRow) {
    db.insert(schema.rolePermissions).values({ roleId: roleRow.id, permissionCode: rp.permissionCode }).run();
  }
}
for (const g of USER_GROUP_SEED) db.insert(schema.userGroups).values(g).run();
for (const pg of PERMISSION_GROUP_SEED) {
  db.insert(schema.permissionGroups).values({
    name: pg.name,
    description: pg.description,
    permissions: JSON.stringify(pg.permissions),
    sort: pg.sort,
    enabled: pg.enabled,
  }).run();
}
for (const a of APP_SEED) db.insert(schema.apps).values(a).run();
// app_menus 需要 app.id 和（parent）menu.id
const menuIdByCode = new Map<string, number>();
for (const m of APP_MENU_SEED) {
  const appRow = db.select().from(schema.apps).where(eq(schema.apps.code, m.appCode)).get();
  if (!appRow) continue;
  const parentId = m.parentCode ? menuIdByCode.get(`${m.appCode}:${m.parentCode}`) ?? null : null;
  const inserted = db.insert(schema.appMenus).values({
    appId: appRow.id,
    code: m.code,
    name: m.name,
    path: m.path,
    parentId,
    sort: m.sort,
    enabled: m.enabled,
  }).returning().get();
  menuIdByCode.set(`${m.appCode}:${m.code}`, inserted.id);
}
for (const k of API_KEY_SEED) {
  const appRow = db.select().from(schema.apps).where(eq(schema.apps.code, k.appCode)).get();
  if (appRow) {
    db.insert(schema.apiKeys).values({
      name: k.name,
      key: k.key,
      appId: appRow.id,
      expiresAt: k.expiresAt,
      enabled: k.enabled,
    }).run();
  }
}
for (const s of SSO_STATE_SEED) db.insert(schema.ssoStates).values(s).run();
for (const log of AUDIT_LOG_SEED) db.insert(schema.auditLogs).values(log).run();
for (const setting of PLATFORM_SETTING_SEED) db.insert(schema.platformSettings).values(setting).run();

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

const stats = {
  tenants: db.select().from(schema.tenants).all().length,
  users: db.select().from(schema.users).all().length,
  orgs: db.select().from(schema.orgs).all().length,
  positions: db.select().from(schema.positions).all().length,
  roles: db.select().from(schema.roles).all().length,
  role_permissions: db.select().from(schema.rolePermissions).all().length,
  user_groups: db.select().from(schema.userGroups).all().length,
  permission_groups: db.select().from(schema.permissionGroups).all().length,
  apps: db.select().from(schema.apps).all().length,
  app_menus: db.select().from(schema.appMenus).all().length,
  api_keys: db.select().from(schema.apiKeys).all().length,
  audit_logs: db.select().from(schema.auditLogs).all().length,
  platform_settings: db.select().from(schema.platformSettings).all().length,
};

console.log(`[seed] done — ${DB_PATH} populated:`);
for (const [table, n] of Object.entries(stats)) {
  console.log(`  ${table}: ${n}`);
}