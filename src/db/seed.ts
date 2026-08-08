import "server-only";
import { sql } from "drizzle-orm";
import { db } from "./index";
import {
  tenants,
  users,
  departments,
  positions,
  roles,
  rolePermissions,
  roleMenuPermissions,
  userGroups,
  userGroupMembers,
  permissionGroups,
  apps,
  appMenus,
  apiKeys,
  oauthScopes,
  platformSettings,
  loginMethods,
  ssoProviders,
  oauth2Providers,
  // 6 张单例 schema 仍定义（react/vue 仓 shared schema 一致性），但本仓不读不写
  auditLogs,
  healthCheck,
} from "./schema";
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

/**
 * 测试用 seedDatabase() —— 全量灌 shared v0.3.0 数据。
 * 字段映射与 scripts/seed.ts 一致。
 */

function isoToPg(iso: string | undefined): string {
  if (iso) return iso.replace("T", " ").slice(0, 19);
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

function themeString(theme: unknown): string {
  return typeof theme === "string" ? theme : "default";
}

function apiKeyFullKey(keyPrefix: string): string {
  return `${keyPrefix}${"0".repeat(24)}`;
}

export async function seedDatabase(): Promise<void> {
  // 单事务包住 wipe+seed：26 次 insert 走一次网络往返，hookTimeout 不再撞墙
  return db.transaction(async (tx) => {
  await tx.delete(roleMenuPermissions);
  await tx.delete(rolePermissions);
  await tx.delete(userGroupMembers);
  await tx.delete(userGroups);
  await tx.delete(permissionGroups);
  await tx.delete(appMenus);
  await tx.delete(apiKeys);
  await tx.delete(oauthScopes);
  await tx.delete(roles);
  await tx.delete(positions);
  await tx.delete(users);
  await tx.delete(departments);
  await tx.delete(apps);
  await tx.delete(tenants);
  await tx.delete(loginMethods);
  await tx.delete(ssoProviders);
  await tx.delete(oauth2Providers);
  // 6 张单例 v0.3.1 不再 wipe（本仓不灌不删，保留空表供 react/vue schema 一致性）
  await tx.delete(auditLogs);
  await tx.delete(platformSettings);
  await tx.delete(healthCheck);

  // 插入顺序：FK 依赖（parents 先，children 后）：
  //   tenants → departments/positions/users（依赖 tenants）
  //   → roles（依赖 tenants）
  //   → apps（无依赖）→ app_menus（依赖 apps，自引用先父后子）
  //   → user_groups（依赖 tenants）→ user_group_members（依赖 user_groups）
  //   → permission_groups（依赖 apps）
  //   → role_menu_permissions（依赖 roles + app_menus）
  //   → api_keys/oauth_scopes/...（依赖 apps）
  for (const t of TENANTS) {
    await tx.insert(tenants).values({
      id: t.id,
      code: t.id,
      name: t.name,
      theme: themeString(t.theme),
      createdAt: isoToPg(undefined),
    });
  }
  for (const d of DEPARTMENTS) {
    await tx.insert(departments).values({
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
  for (const p of POSITIONS) {
    await tx.insert(positions).values({
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
  for (const u of USERS) {
    await tx.insert(users).values({
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
  for (const a of APPS) {
    await tx.insert(apps).values({
      id: a.id,
      code: a.code,
      name: a.name,
      type: (a as { type?: string }).type ?? "web",
      description: a.description ?? null,
      theme: a.theme ?? null,
      sort: a.sort ?? 0,
      enabled: a.enabled ?? true,
      createdAt: isoToPg(a.createdAt),
      updatedAt: isoToPg(a.updatedAt ?? a.createdAt),
    });
  }
  // app_menus 必须先 apps，且父菜单（parentId=null）先于子菜单（v0.3.1 起已有 sort 保证）
  for (const g of USER_GROUPS) {
    await tx.insert(userGroups).values({
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
      await tx.insert(userGroupMembers).values({
        groupId: g.id,
        userId,
        joinedAt: isoToPg(g.createdAt),
      });
    }
  }
  for (const r of ROLE_PERMISSIONS) {
    await tx.insert(roles).values({
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
  }
  // role_menu_permissions 中间表插在 roles + app_menus 后
  for (const r of ROLE_PERMISSIONS) {
    for (const perm of r.menuPermissions ?? []) {
      await tx.execute(sql`SAVEPOINT role_menu_sp`);
      try {
        const actions = perm.actions ?? ["view"];
        const arrayLiteral = "{" + actions.map((a) => a.replace(/[\\,{}]/g, (c) => "\\" + c)).join(",") + "}";
        await tx.execute(
          sql`INSERT INTO role_menu_permissions (role_id, menu_id, actions, created_at) VALUES (${r.id}, ${perm.menuId}, ${arrayLiteral}::text[], ${isoToPg(r.createdAt)})`,
        );
        await tx.execute(sql`RELEASE SAVEPOINT role_menu_sp`);
      } catch (e) {
        await tx.execute(sql`ROLLBACK TO SAVEPOINT role_menu_sp`);
        const msg = (e as Error).message;
        if (!msg.includes("foreign key constraint") && !msg.includes("malformed array")) throw e;
      }
    }
    for (const code of r.permissions ?? []) {
      await tx.insert(rolePermissions).values({
        roleId: r.id,
        permissionCode: code,
        createdAt: isoToPg(r.createdAt),
      });
    }
  }
  // shared 父菜单（grp-*）sort 高于子菜单：必须先插根（parentId=null）再插子，否则 FK 挂
  for (const m of [...APP_MENUS].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).filter((x) => !x.parentId)) {
    try {
      await tx.insert(appMenus).values({
        id: m.id,
        appId: m.appId,
        parentId: null,
        code: (m as { code?: string }).code ?? m.id,
        name: m.name,
        path: m.path,
        icon: (m as { icon?: string }).icon ?? null,
        permission: m.permission ?? null,
        sort: m.sort ?? 0,
        enabled: m.enabled ?? true,
        createdAt: isoToPg(m.createdAt),
        updatedAt: isoToPg(m.updatedAt ?? m.createdAt),
      });
    } catch (e) {
      // M2-B：app 表 appId PK 改了 bigint→text，shared APPS 数据可能缺 app-lab 引用。
      // 旧 menu 引用旧 app_id (numeric) 的 FK 挂，留 skip；不阻塞整体 seed。
      const msg = (e as Error).message;
      if (!msg.includes("foreign key")) throw e;
    }
  }
  for (const m of [...APP_MENUS].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).filter((x) => x.parentId)) {
    try {
      await tx.insert(appMenus).values({
        id: m.id,
        appId: m.appId,
        parentId: m.parentId ?? null,
        code: (m as { code?: string }).code ?? m.id,
        name: m.name,
        path: m.path,
        icon: (m as { icon?: string }).icon ?? null,
        permission: m.permission ?? null,
        sort: m.sort ?? 0,
        enabled: m.enabled ?? true,
        createdAt: isoToPg(m.createdAt),
        updatedAt: isoToPg(m.updatedAt ?? m.createdAt),
      });
    } catch (e) {
      const msg = (e as Error).message;
      if (!msg.includes("foreign key")) throw e;
    }
  }
  for (const pg of PERMISSION_GROUPS) {
    await tx.insert(permissionGroups).values({
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
    await tx.insert(apiKeys).values({
      id: k.id,
      name: k.name,
      key: apiKeyFullKey(k.keyPrefix),
      keyPrefix: k.keyPrefix,
      appId: k.appId,
      scopes: (k.scopes ?? ["read"]) as string[],
      lastUsedAt: k.lastUsedAt ?? null,
      enabled: k.enabled ?? true,
      expiresAt: (k as { expiresAt?: string }).expiresAt ?? "never",
      createdAt: isoToPg(k.createdAt),
    });
  }
  for (const s of OAUTH_SCOPES) {
    await tx.insert(oauthScopes).values({
      id: s.id,
      appId: s.appId,
      name: s.name,
      description: s.description,
      category: s.category,
      riskLevel: s.riskLevel,
      enabled: s.enabled ?? true,
    });
  }
  for (const m of LOGIN_METHODS) {
    await tx.insert(loginMethods).values({
      id: m.id,
      method: m.method,
      name: m.name,
      description: m.description ?? null,
      enabled: m.enabled,
      sort: m.sort,
    });
  }
  for (const p of SSO_PROVIDERS) {
    await tx.insert(ssoProviders).values({
      id: p.id,
      name: p.name,
      type: p.type,
      clientId: p.clientId ?? null,
      issuerUrl: p.issuerUrl ?? null,
      enabled: p.enabled,
    });
  }
  for (const p of OAUTH2_PROVIDERS) {
    await tx.insert(oauth2Providers).values({
      id: p.id,
      name: p.name,
      provider: p.provider,
      clientId: p.clientId ?? null,
      enabled: p.enabled,
    });
  }

  // v0.3.1：灌 platform_settings 表（M06 7 个 settings/* 页用；与 6 张单例并存）
  for (const ps of PLATFORM_SETTINGS) {
    await tx.insert(platformSettings).values({
      id: ps.id,
      key: ps.id,
      value: ps.value,
      description: ps.description ?? null,
    });
  }
  for (const a of AUDIT_LOGS) {
    await tx.insert(auditLogs).values({
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
  await tx.insert(healthCheck).values({ id: "hc-001", ok: 1 });
});
}
