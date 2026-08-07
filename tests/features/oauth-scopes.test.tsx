/**
 * M06.F10 OAuth scope 注册表（fn-ID M06.F10.I01-I05）
 *
 * 数据：oauth_scopes 表 CRUD（/auth/permissions 路由强依赖）。
 *
 * 覆盖：I01 列表 / I02 按 app 查询 / I03 新增 / I04 编辑 / I05 删除
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  listOauthScopes,
  listOauthScopesByApp,
  getOauthScope,
  createOauthScope,
  updateOauthScope,
  deleteOauthScope,
} from "@/lib/oauth-scope-store";
import { seedDatabase } from "@/db/seed";
import { db } from "@/db";
import { oauthScopes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fnTest } from "../fn";

beforeAll(async () => {
  await seedDatabase();
});

describe("M06.F10 OAuth scopes", () => {
  fnTest(["M06.F10.I01"], "I01 OAuth scope 列表（灌库后至少 1 行）", async () => {
    const rows = await listOauthScopes();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.appId).toBeTruthy();
      expect(row.name).toBeTruthy();
      expect(row.category).toBeTruthy();
      expect(row.riskLevel).toBeTruthy();
    }
  });

  fnTest(["M06.F10.I02"], "I02 按 app 查询（app-lab 应至少 1 行）", async () => {
    const rows = await listOauthScopesByApp("app-lab");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.appId).toBe("app-lab");
    }
  });

  fnTest(["M06.F10.I02"], "I02 不存在的 app 返回空数组", async () => {
    const rows = await listOauthScopesByApp("app-not-exist");
    expect(rows).toEqual([]);
  });

  fnTest(["M06.F10.I03"], "I03 新增 OAuth scope", async () => {
    const created = await createOauthScope({
      id: "scope-test-01",
      appId: "app-lab",
      name: "scope:custom.read",
      description: "自定义测试 scope",
      category: "user",
      riskLevel: "low",
      enabled: true,
    });
    expect(created.id).toBe("scope-test-01");
    expect(created.appId).toBe("app-lab");

    // 真的落到数据库
    const [row] = await db.select().from(oauthScopes).where(eq(oauthScopes.id, "scope-test-01"));
    expect(row).toBeTruthy();
  });

  fnTest(["M06.F10.I04"], "I04 编辑：updateOauthScope 改 name + description", async () => {
    const updated = await updateOauthScope("scope-test-01", {
      name: "scope:custom.read.v2",
      description: "更新后描述",
    });
    expect(updated).toBeTruthy();
    expect(updated!.name).toBe("scope:custom.read.v2");
    expect(updated!.description).toBe("更新后描述");
    // 其他字段不动
    expect(updated!.appId).toBe("app-lab");
    expect(updated!.category).toBe("user");
  });

  fnTest(["M06.F10.I04"], "I04 编辑不存在的 scope 返回 null", async () => {
    const updated = await updateOauthScope("scope-not-exist", {
      name: "x",
    });
    expect(updated).toBeNull();
  });

  fnTest(["M06.F10.I05"], "I05 删除 OAuth scope", async () => {
    const deleted = await deleteOauthScope("scope-test-01");
    expect(deleted).toBe(true);

    // 二次查已删
    const after = await getOauthScope("scope-test-01");
    expect(after).toBeNull();
  });

  fnTest(["M06.F10.I05"], "I05 删除不存在的 scope 返回 false", async () => {
    const deleted = await deleteOauthScope("scope-not-exist");
    expect(deleted).toBe(false);
  });

  fnTest(["M06.F10.I01"], "I01 直接查中间表：所有 scope 都有 riskLevel", async () => {
    const rows = await db.select().from(oauthScopes);
    const validRiskLevels = ["low", "medium", "high"];
    for (const row of rows) {
      expect(validRiskLevels).toContain(row.riskLevel);
    }
  });

  it("M06.F10 共享 seed 数据校验：app-lab 下至少 1 条 scope", async () => {
    const rows = await listOauthScopesByApp("app-lab");
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });
});