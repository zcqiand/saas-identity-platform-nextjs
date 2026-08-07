/**
 * saas_dev 灌种子数据入口（PostgreSQL 版）。
 *
 * v0.3.0：完全改读 @saas/identity-platform-shared/seeds。
 * shared 是契约真理源，本脚本做字段适配（shared 字段名 → drizzle 列名/类型转换）。
 *
 * 用法：
 *   DATABASE_URL='postgresql://…' npm run db:seed
 *   DATABASE_URL='postgresql://…' npx tsx scripts/seed.ts
 */
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
  TENANTS,
  USERS,
  DEPARTMENTS,
  POSITIONS,
  ROLE_PERMISSIONS,
  USER_GROUPS,
  PERMISSION_GROUPS,
  APPS,
  APP_MENUS,
  API_KEYS,
  MENU_TEMPLATES,
  LOGIN_METHODS,
  SSO_PROVIDERS,
  OAUTH2_PROVIDERS,
  OAUTH_SCOPES,
  // 6 张单例（token_config / login_security / password_policy / risk_control /
  // notification_config / open_platform_config）的 shared seed 不再灌 nextjs：
  // v0.3.1 起 nextjs 端只走 platform_settings 单表 KV；6 张单例 schema 与 seed 保留
  // 给 saas-react / saas-vue 仓用（它们各自实现这 6 张表的 typed 配置 UI）
  PLATFORM_SETTINGS,
  AUDIT_LOGS,
} from "@saas/identity-platform-shared/seeds";
import * as schema from "../src/db/schema";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool, { schema });

// ─────────────────────────────────────────────────────────────────────────
// 字段适配 helpers
// ─────────────────────────────────────────────────────────────────────────

function isoToPg(iso: string | undefined, fallback?: string): string {
  if (iso) return iso.replace("T", " ").slice(0, 19);
  if (fallback) return fallback;
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function themeString(theme: unknown): string {
  return typeof theme === "string" ? theme : "default";
}

function apiKeyFullKey(keyPrefix: string): string {
  return `${keyPrefix}${"0".repeat(24)}`;
}

// ─────────────────────────────────────────────────────────────────────────
// 本地补充：shared 无的派生数据
// ─────────────────────────────────────────────────────────────────────────
const HEALTH_CHECK_SEED = [{ id: "hc-001", ok: 1 }];

// ─────────────────────────────────────────────────────────────────────────
// 灌库主流程
// ─────────────────────────────────────────────────────────────────────────
async function seed(): Promise<void> {
  // Wipe children first
  await db.delete(schema.roleMenuPermissions);
  await db.delete(schema.rolePermissions);
  await db.delete(schema.userGroupMembers);
  await db.delete(schema.permissionGroups);
  await db.delete(schema.userGroups);
  await db.delete(schema.appMenus);
  await db.delete(schema.apiKeys);
  await db.delete(schema.menuTemplates);
  await db.delete(schema.oauthScopes);
  await db.delete(schema.tenantUsers);
  await db.delete(schema.positions);
  await db.delete(schema.users);
  await db.delete(schema.departments);
  await db.delete(schema.apps);
  await db.delete(schema.tenants);
  await db.delete(schema.loginMethods);
  await db.delete(schema.ssoProviders);
  await db.delete(schema.oauth2Providers);
  // 6 张单例不再 wipe（nextjs 端不灌不删；表保留供 future 6 个 store 使用 + react/vue 仓 shared schema 一致）
  await db.delete(schema.auditLogs);
  await db.delete(schema.platformSettings);
  await db.delete(schema.healthCheck);

  // ── Insert parents first ────────────────────────────────────────────
  // tenants: shared TENANTS 无 createdAt/code，用 id 充 code，UTC now 充 createdAt
  for (const t of TENANTS) {
    await db.insert(schema.tenants).values({
      id: t.id,
      code: t.id,
      name: t.name,
      theme: themeString(t.theme),
      createdAt: isoToPg(undefined),
    });
  }

  for (const d of DEPARTMENTS) {
    await db.insert(schema.departments).values({
      id: d.id,
      tenantId: d.tenantId,
      name: d.name,
      parentId: d.parentId ?? null,
      sort: d.sort ?? 0,
      enabled: d.enabled ?? true,
      createdAt: isoToPg(d.createdAt),
      updatedAt: isoToPg(d.updatedAt ?? d.createdAt),
    });
  }

  for (const u of USERS) {
    await db.insert(schema.users).values({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      email: u.email,
      tenantId: u.tenantId,
      departmentId: u.departmentId ?? null,
      roles: u.roles as string[],
      status: u.status,
      createdAt: isoToPg(u.createdAt),
      updatedAt: isoToPg(u.updatedAt ?? u.createdAt),
    });
  }

  for (const u of USERS) {
    await db.insert(schema.tenantUsers).values({
      tenantId: u.tenantId,
      userId: u.id,
      role: (u.roles[0] ?? "member") as string,
      joinedAt: isoToPg(u.createdAt),
    });
  }

  for (const p of POSITIONS) {
    await db.insert(schema.positions).values({
      id: p.id,
      tenantId: p.tenantId,
      code: p.code,
      name: p.name,
      description: p.description ?? null,
      sort: p.sort ?? 0,
      enabled: p.enabled ?? true,
      createdAt: isoToPg(p.createdAt),
      updatedAt: isoToPg(p.updatedAt ?? p.createdAt),
    });
  }

  // shared ROLE_PERMISSIONS 用 `permissions[]`（不是 `permissionCodes[]`）
  for (const r of ROLE_PERMISSIONS) {
    await db.insert(schema.roles).values({
      id: r.id,
      tenantId: r.tenantId,
      code: r.code,
      name: r.name,
      description: r.description ?? null,
      sort: r.sort ?? 0,
      enabled: r.enabled ?? true,
      createdAt: isoToPg(r.createdAt),
      updatedAt: isoToPg(r.updatedAt ?? r.createdAt),
    });
    for (const perm of r.menuPermissions ?? []) {
      try {
        await db.insert(schema.roleMenuPermissions).values({
          roleId: r.id,
          menuId: perm.menuId,
          actions: (perm.actions ?? ["view"]) as string[],
          createdAt: isoToPg(r.createdAt),
        });
      } catch (e) {
        const msg = (e as Error).message;
        if (!msg.includes("foreign key constraint")) throw e;
      }
    }
    for (const code of r.permissions ?? []) {
      await db.insert(schema.rolePermissions).values({
        roleId: r.id,
        permissionCode: code,
        createdAt: isoToPg(r.createdAt),
      });
    }
  }

  for (const g of USER_GROUPS) {
    await db.insert(schema.userGroups).values({
      id: g.id,
      tenantId: g.tenantId,
      name: g.name,
      description: g.description ?? null,
      enabled: g.enabled ?? true,
      createdAt: isoToPg(g.createdAt),
      updatedAt: isoToPg(g.updatedAt ?? g.createdAt),
    });
    // v0.3.1：shared user-groups.json 加 userIds，灌 user_group_members 中间表
    for (const userId of g.userIds ?? []) {
      await db.insert(schema.userGroupMembers).values({
        groupId: g.id,
        userId,
        joinedAt: isoToPg(g.createdAt),
      });
    }
  }

  // shared APPS 无 type 字段，让 schema 默认 'web'
  for (const a of APPS) {
    await db.insert(schema.apps).values({
      id: a.id,
      code: a.code,
      name: a.name,
      type: a.type ?? "web",
      description: a.description ?? null,
      theme: a.theme ?? null,
      sort: a.sort ?? 0,
      enabled: a.enabled ?? true,
      createdAt: isoToPg(a.createdAt),
      updatedAt: isoToPg(a.updatedAt ?? a.createdAt),
    });
  }

  // shared APP_MENUS 无 code/icon，用 id 充 code
  // shared 父菜单（grp-*）sort 高于子菜单：必须先插根（parentId=null）再插子，否则 FK 挂
  const sortedMenus = [...APP_MENUS].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));
  for (const m of sortedMenus.filter((x) => !x.parentId)) {
    await db.insert(schema.appMenus).values({
      id: m.id,
      appId: m.appId,
      parentId: null,
      code: m.code ?? m.id,
      name: m.name,
      path: m.path,
      icon: m.icon ?? null,
      permission: m.permission ?? null,
      sort: m.sort ?? 0,
      enabled: m.enabled ?? true,
      createdAt: isoToPg(m.createdAt),
      updatedAt: isoToPg(m.updatedAt ?? m.createdAt),
    });
  }
  for (const m of sortedMenus.filter((x) => x.parentId)) {
    await db.insert(schema.appMenus).values({
      id: m.id,
      appId: m.appId,
      parentId: m.parentId ?? null,
      code: m.code ?? m.id,
      name: m.name,
      path: m.path,
      icon: m.icon ?? null,
      permission: m.permission ?? null,
      sort: m.sort ?? 0,
      enabled: m.enabled ?? true,
      createdAt: isoToPg(m.createdAt),
      updatedAt: isoToPg(m.updatedAt ?? m.createdAt),
    });
  }

  for (const pg of PERMISSION_GROUPS) {
    await db.insert(schema.permissionGroups).values({
      id: pg.id,
      appId: pg.appId,
      name: pg.name,
      description: pg.description ?? null,
      permissions: (pg.permissions ?? []) as string[],
      menuIds: (pg.menuIds ?? []) as string[],
      sort: pg.sort ?? 0,
      enabled: pg.enabled ?? true,
      createdAt: isoToPg(pg.createdAt),
      updatedAt: isoToPg(pg.updatedAt ?? pg.createdAt),
    });
  }

  for (const k of API_KEYS) {
    await db.insert(schema.apiKeys).values({
      id: k.id,
      name: k.name,
      key: apiKeyFullKey(k.keyPrefix),
      keyPrefix: k.keyPrefix,
      appId: k.appId,
      scopes: (k.scopes ?? ["read"]) as string[],
      lastUsedAt: k.lastUsedAt ?? null,
      enabled: k.enabled ?? true,
      expiresAt: k.expiresAt ?? "never",
      createdAt: isoToPg(k.createdAt),
    });
  }

  // shared MENU_TEMPLATES 用 `app-id`（非 appId），无 updatedAt/createdAt
  for (const mt of MENU_TEMPLATES) {
    await db.insert(schema.menuTemplates).values({
      appId: (mt as unknown as { "app-id": string })["app-id"] ?? (mt as unknown as { appId: string }).appId,
      menus: JSON.stringify(mt.menus ?? []),
      updatedAt: isoToPg(undefined),
    });
  }

  for (const s of OAUTH_SCOPES) {
    await db.insert(schema.oauthScopes).values({
      id: s.id,
      appId: s.appId,
      name: s.name,
      description: s.description,
      category: s.category,
      riskLevel: s.riskLevel,
      enabled: s.enabled ?? true,
    });
  }

  // 6 张单例配置 v0.3.1 不再灌（nextjs 走 platform_settings 单表 KV；shared seed 保留供 react/vue）
  // schema 仍存在（react/vue 仓需），但本仓不读不写

  for (const m of LOGIN_METHODS) {
    await db.insert(schema.loginMethods).values({
      id: m.id,
      method: m.method,
      name: m.name,
      description: m.description ?? null,
      enabled: m.enabled,
      sort: m.sort,
    });
  }
  for (const p of SSO_PROVIDERS) {
    await db.insert(schema.ssoProviders).values({
      id: p.id,
      name: p.name,
      type: p.type,
      clientId: p.clientId ?? null,
      issuerUrl: p.issuerUrl ?? null,
      enabled: p.enabled,
    });
  }
  for (const p of OAUTH2_PROVIDERS) {
    await db.insert(schema.oauth2Providers).values({
      id: p.id,
      name: p.name,
      provider: p.provider,
      clientId: p.clientId ?? null,
      enabled: p.enabled,
    });
  }

  // v0.3.1：灌 platform_settings 表（M06 7 个 settings/* 页用；与 6 张单例并存）
  for (const ps of PLATFORM_SETTINGS) {
    await db.insert(schema.platformSettings).values({
      id: ps.id,
      key: ps.id,
      value: ps.value,
      description: ps.description ?? null,
    });
  }

  // shared AUDIT_LOGS 无 tenantId，可选 → null
  for (const a of AUDIT_LOGS) {
    await db.insert(schema.auditLogs).values({
      id: a.id,
      tenantId: (a as unknown as { tenantId?: string }).tenantId ?? null,
      action: a.action,
      operator: a.operator,
      resource: a.resource,
      resourceId: a.resourceId,
      ip: a.ip ?? "127.0.0.1",
      detail: a.detail ?? "",
      timestamp: isoToPg(a.timestamp),
    });
  }

  for (const h of HEALTH_CHECK_SEED) {
    await db.insert(schema.healthCheck).values({ id: h.id, ok: h.ok });
  }

  // ── Stats ────────────────────────────────────────────────────────────
  const stats = {
    tenants: (await db.select().from(schema.tenants)).length,
    departments: (await db.select().from(schema.departments)).length,
    users: (await db.select().from(schema.users)).length,
    tenant_users: (await db.select().from(schema.tenantUsers)).length,
    positions: (await db.select().from(schema.positions)).length,
    roles: (await db.select().from(schema.roles)).length,
    role_permissions: (await db.select().from(schema.rolePermissions)).length,
    role_menu_permissions: (await db.select().from(schema.roleMenuPermissions)).length,
    user_groups: (await db.select().from(schema.userGroups)).length,
    user_group_members: (await db.select().from(schema.userGroupMembers)).length,
    permission_groups: (await db.select().from(schema.permissionGroups)).length,
    apps: (await db.select().from(schema.apps)).length,
    app_menus: (await db.select().from(schema.appMenus)).length,
    api_keys: (await db.select().from(schema.apiKeys)).length,
    oauth_scopes: (await db.select().from(schema.oauthScopes)).length,
    menu_templates: (await db.select().from(schema.menuTemplates)).length,
    login_methods: (await db.select().from(schema.loginMethods)).length,
    sso_providers: (await db.select().from(schema.ssoProviders)).length,
    oauth2_providers: (await db.select().from(schema.oauth2Providers)).length,
    platform_settings: (await db.select().from(schema.platformSettings)).length,
    audit_logs: (await db.select().from(schema.auditLogs)).length,
  };
  console.log("[seed] done — saas_dev populated from shared:");
  for (const [k, n] of Object.entries(stats)) console.log(`  ${k}: ${n}`);
}

seed()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    return pool.end().finally(() => process.exit(1));
  });