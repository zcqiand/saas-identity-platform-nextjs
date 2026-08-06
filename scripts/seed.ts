/**
 * saas_dev 灌种子数据入口（PostgreSQL 版）。
 *
 * 用法：
 *   DATABASE_URL='postgresql://…' npm run db:seed
 *   DATABASE_URL='postgresql://…' npx tsx scripts/seed.ts
 *
 * 这个脚本**不**走 src/db/index.ts（它有 `import "server-only"`，tsx 没有 next bundler
 * 上下文会抛），而是自己开 pg.Pool + drizzle 直连 DATABASE_URL。fixture 与 src/db/seed.ts
 * 的精简版互补——这里更全（5 user / 4 org / 完整 platform_settings 等），用于 saas_dev
 * 端到端联调；src/db/seed.ts 是测试用精简版（11 表 + 4 关联表的最小集）。
 *
 * 覆盖表：tenants / users / orgs / positions / roles / role_permissions /
 *        user_groups / permission_groups / apps / app_menus / api_keys /
 *        platform_settings / sso_states / audit_logs / tenant_users 等。
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema });

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
  const iso = (offsetDays: number) => new Date(now - offsetDays * day).toISOString().replace("T", " ").slice(0, 19);
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

async function seed(): Promise<void> {
  // Wipe in FK-safe order (children first)
  await db.delete(schema.userGroupMembers);
  await db.delete(schema.userGroups);
  await db.delete(schema.positionMembers);
  await db.delete(schema.positions);
  await db.delete(schema.rolePermissions);
  await db.delete(schema.roles);
  await db.delete(schema.permissionGroups);
  await db.delete(schema.orgs);
  await db.delete(schema.tenantUsers);
  await db.delete(schema.users);
  await db.delete(schema.appMenus);
  await db.delete(schema.apps);
  await db.delete(schema.apiKeys);
  await db.delete(schema.auditLogs);
  await db.delete(schema.platformSettings);
  await db.delete(schema.ssoStates);
  await db.delete(schema.tenants);

  // Insert in FK-safe order (parents first)
  for (const t of TENANT_SEED) await db.insert(schema.tenants).values(t);
  for (const u of USER_SEED) await db.insert(schema.users).values(u);

  // 给每个 user 配 tenant_users 关联（默认 acme + member）
  for (const u of USER_SEED) {
    const [userRow] = await db.select().from(schema.users).where(eq(schema.users.username, u.username));
    const [tenantRow] = await db.select().from(schema.tenants).where(eq(schema.tenants.code, "acme"));
    if (userRow && tenantRow) {
      await db.insert(schema.tenantUsers).values({ tenantId: tenantRow.id, userId: userRow.id, role: u.username === "alice" ? "admin" : "member" });
    }
  }

  for (const o of ORG_SEED) await db.insert(schema.orgs).values(o);
  for (const p of POSITION_SEED) await db.insert(schema.positions).values(p);
  for (const r of ROLE_SEED) await db.insert(schema.roles).values(r);

  // role_permissions 需要 role.id
  for (const rp of ROLE_PERMISSION_SEED) {
    const [roleRow] = await db.select().from(schema.roles).where(eq(schema.roles.code, rp.roleCode));
    if (roleRow) {
      await db.insert(schema.rolePermissions).values({ roleId: roleRow.id, permissionCode: rp.permissionCode });
    }
  }
  for (const g of USER_GROUP_SEED) await db.insert(schema.userGroups).values(g);
  for (const pg of PERMISSION_GROUP_SEED) {
    await db.insert(schema.permissionGroups).values({
      name: pg.name,
      description: pg.description,
      permissions: JSON.stringify(pg.permissions),
      sort: pg.sort,
      enabled: pg.enabled,
    });
  }
  for (const a of APP_SEED) await db.insert(schema.apps).values(a);
  // app_menus 需要 app.id 和（parent）menu.id
  const menuIdByCode = new Map<string, number>();
  for (const m of APP_MENU_SEED) {
    const [appRow] = await db.select().from(schema.apps).where(eq(schema.apps.code, m.appCode));
    if (!appRow) continue;
    const parentId = m.parentCode ? menuIdByCode.get(`${m.appCode}:${m.parentCode}`) ?? null : null;
    const [inserted] = await db.insert(schema.appMenus).values({
      appId: appRow.id,
      code: m.code,
      name: m.name,
      path: m.path,
      parentId,
      sort: m.sort,
      enabled: m.enabled,
    }).returning();
    menuIdByCode.set(`${m.appCode}:${m.code}`, inserted.id);
  }
  for (const k of API_KEY_SEED) {
    const [appRow] = await db.select().from(schema.apps).where(eq(schema.apps.code, k.appCode));
    if (appRow) {
      await db.insert(schema.apiKeys).values({
        name: k.name,
        key: k.key,
        appId: appRow.id,
        expiresAt: k.expiresAt,
        enabled: k.enabled,
      });
    }
  }
  for (const s of SSO_STATE_SEED) await db.insert(schema.ssoStates).values(s);
  for (const log of AUDIT_LOG_SEED) await db.insert(schema.auditLogs).values(log);
  for (const setting of PLATFORM_SETTING_SEED) await db.insert(schema.platformSettings).values(setting);

  // Stats
  const tenantsN = (await db.select().from(schema.tenants)).length;
  const usersN = (await db.select().from(schema.users)).length;
  const orgsN = (await db.select().from(schema.orgs)).length;
  const positionsN = (await db.select().from(schema.positions)).length;
  const rolesN = (await db.select().from(schema.roles)).length;
  const rolePermsN = (await db.select().from(schema.rolePermissions)).length;
  const userGroupsN = (await db.select().from(schema.userGroups)).length;
  const permGroupsN = (await db.select().from(schema.permissionGroups)).length;
  const appsN = (await db.select().from(schema.apps)).length;
  const appMenusN = (await db.select().from(schema.appMenus)).length;
  const apiKeysN = (await db.select().from(schema.apiKeys)).length;
  const auditLogsN = (await db.select().from(schema.auditLogs)).length;
  const platformSettingsN = (await db.select().from(schema.platformSettings)).length;

  console.log("[seed] done — saas_dev populated:");
  for (const [table, n] of Object.entries({
    tenants: tenantsN,
    users: usersN,
    orgs: orgsN,
    positions: positionsN,
    roles: rolesN,
    role_permissions: rolePermsN,
    user_groups: userGroupsN,
    permission_groups: permGroupsN,
    apps: appsN,
    app_menus: appMenusN,
    api_keys: apiKeysN,
    audit_logs: auditLogsN,
    platform_settings: platformSettingsN,
  })) {
    console.log(`  ${table}: ${n}`);
  }
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    return pool.end().finally(() => process.exit(1));
  });
