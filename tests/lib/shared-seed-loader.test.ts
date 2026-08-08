/**
 * M01.F06 shared-seed-loader —— 灌库契约测试
 *
 * seedDatabase() 必须把 @saas/identity-platform-shared/seeds/*.json 全量
 * 灌进 drizzle 的对应表。后续所有业务测试都假设这套 seed 已就绪。
 *
 * 覆盖：M01.F06（灌库契约）/ 各表至少 1 行（不可空）
 */
import { afterAll, beforeAll, describe, expect } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  tenants,
  users,
  departments,
  positions,
  roles,
  roleMenuPermissions,
  userGroups,
  permissionGroups,
  apps,
  appMenus,
  apiKeys,
  oauthScopes,
  loginMethods,
  ssoProviders,
  oauth2Providers,
  tokenConfig,
  loginSecurity,
  passwordPolicy,
  riskControl,
  notificationConfig,
  openPlatformConfig,
  auditLogs,
} from "@/db/schema";
import { seedDatabase } from "@/db/seed";
import { fnTest } from "../fn";

beforeAll(async () => {
  await seedDatabase();
});

afterAll(async () => {
  // 不清库 —— 后续业务测试可能复用 seed；每个测试文件独立 per-pid schema，自然隔离
});

describe("M01.F06 shared-seed-loader", () => {
  fnTest(["M01.F06"], "tenants 表至少灌入 acme + tenant-lab", async () => {
    const rows = await db.select().from(tenants);
    expect(rows.length).toBeGreaterThanOrEqual(2);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("acme");
    expect(ids).toContain("tenant-lab");
  });

  fnTest(["M01.F06"], "acme 租户的 name 为「ACME 集团」", async () => {
    const [row] = await db.select().from(tenants).where(eq(tenants.id, "acme"));
    expect(row).toBeTruthy();
    expect(row!.name).toBe("ACME 集团");
  });

  fnTest(["M01.F06"], "users 表至少 10 行（含 u-001/u-lab-01/u-lab-02）", async () => {
    const rows = await db.select().from(users);
    expect(rows.length).toBeGreaterThanOrEqual(10);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("u-001");
    expect(ids).toContain("u-lab-01");
    expect(ids).toContain("u-lab-02");
  });

  fnTest(["M01.F06"], "u-001.roles 为数组 [admin]（PG text[]）", async () => {
    const [row] = await db.select().from(users).where(eq(users.id, "u-001"));
    expect(row).toBeTruthy();
    expect(row!.tenantId).toBe("acme");
    expect(row!.roles).toEqual(["admin"]);
  });

  fnTest(["M01.F06"], "departments 表灌入 org-acme + org-lab-root", async () => {
    const rows = await db.select().from(departments);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("org-acme");
    expect(ids).toContain("org-lab-root");
  });

  fnTest(["M01.F06"], "roles 表灌入至少 role-admin + role-lab-admin", async () => {
    const rows = await db.select().from(roles);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("role-admin");
    expect(ids).toContain("role-lab-admin");
    const [admin_row] = await db.select().from(roles).where(eq(roles.id, "role-admin"));
    expect(admin_row).toBeTruthy();
    expect(admin_row!.tenantId).toBe("acme");
  });

  fnTest(["M01.F06"], "role_menu_permissions 中间表灌入（role-admin 应有多条）", async () => {
    const rows = await db.select().from(roleMenuPermissions);
    expect(rows.length).toBeGreaterThan(0);
    const adminPerms = rows.filter((r) => r.roleId === "role-admin");
    expect(adminPerms.length).toBeGreaterThan(5);
    // actions 是 PG text[] 数组
    expect(adminPerms[0]!.actions.length).toBeGreaterThan(0);
  });

  fnTest(["M01.F06"], "user_groups + permission_groups 各至少 1 行", async () => {
    const ugRows = await db.select().from(userGroups);
    expect(ugRows.length).toBeGreaterThan(0);
    const pgRows = await db.select().from(permissionGroups);
    expect(pgRows.length).toBeGreaterThan(0);
  });

  fnTest(["M01.F06"], "apps 表灌入 app-lab / app-erp / app-finance 3 行", async () => {
    const rows = await db.select().from(apps);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("app-lab");
    expect(ids).toContain("app-erp");
    expect(ids).toContain("app-finance");
    expect(rows.length).toBe(3);
  });

  fnTest(["M01.F06"], "app_menus 表灌入（app-lab 应有 ≥1 行）", async () => {
    const rows = await db.select().from(appMenus);
    const labMenus = rows.filter((r) => r.appId === "app-lab");
    expect(labMenus.length).toBeGreaterThan(0);
  });

  fnTest(["M01.F06"], "api_keys 表灌入 ak-001/002/003 + scopes 数组", async () => {
    const rows = await db.select().from(apiKeys);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("ak-001");
    const [ak001] = await db.select().from(apiKeys).where(eq(apiKeys.id, "ak-001"));
    expect(ak001).toBeTruthy();
    expect(ak001!.appId).toBe("app-lab");
    expect(Array.isArray(ak001!.scopes)).toBe(true);
  });

  fnTest(["M01.F06"], "oauth_scopes 至少 1 行", async () => {
    const scopes = await db.select().from(oauthScopes);
    expect(scopes.length).toBeGreaterThan(0);
  });

  fnTest(["M01.F06"], "6 张单例表各至少 1 行（default 行）", async () => {
    expect((await db.select().from(tokenConfig)).length).toBeGreaterThan(0);
    expect((await db.select().from(loginSecurity)).length).toBeGreaterThan(0);
    expect((await db.select().from(passwordPolicy)).length).toBeGreaterThan(0);
    expect((await db.select().from(riskControl)).length).toBeGreaterThan(0);
    expect((await db.select().from(notificationConfig)).length).toBeGreaterThan(0);
    expect((await db.select().from(openPlatformConfig)).length).toBeGreaterThan(0);
  });

  fnTest(["M01.F06"], "登录方式 / SSO / OAuth2 提供商各至少 1 行", async () => {
    expect((await db.select().from(loginMethods)).length).toBeGreaterThan(0);
    expect((await db.select().from(ssoProviders)).length).toBeGreaterThan(0);
    expect((await db.select().from(oauth2Providers)).length).toBeGreaterThan(0);
  });

  fnTest(["M01.F06"], "audit_logs 灌入至少 log-001 .. log-010", async () => {
    const rows = await db.select().from(auditLogs);
    expect(rows.length).toBeGreaterThanOrEqual(10);
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("log-001");
    // log-001 关联到 acme 租户
    const [log1] = await db.select().from(auditLogs).where(eq(auditLogs.id, "log-001"));
    expect(log1).toBeTruthy();
    expect(log1!.tenantId).toBe("acme");
  });

  fnTest(["M01.F06"], "positions 表至少 1 行（lab 租户）", async () => {
    const rows = await db.select().from(positions);
    expect(rows.length).toBeGreaterThan(0);
  });
});