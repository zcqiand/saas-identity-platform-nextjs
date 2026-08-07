/**
 * M06.F13 OAuth2 提供商（fn-ID M06.F13.I01-I04）
 *
 * 数据：oauth2_providers 表 CRUD。
 *
 * 覆盖：I01 列表 / I02 新增 / I03 编辑 / I04 删除
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  listOauth2Providers,
  getOauth2Provider,
  createOauth2Provider,
  updateOauth2Provider,
  deleteOauth2Provider,
} from "@/lib/oauth2-provider-store";
import { seedDatabase } from "@/db/seed";
import { db } from "@/db";
import { oauth2Providers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fnTest } from "../fn";

beforeAll(async () => {
  await seedDatabase();
});

describe("M06.F13 OAuth2 providers", () => {
  fnTest(["M06.F13.I01"], "I01 OAuth2 提供商列表（灌库后 ≥ 3 行）", async () => {
    const rows = await listOauth2Providers();
    expect(rows.length).toBeGreaterThanOrEqual(3);
    for (const row of rows) {
      expect(row.name).toBeTruthy();
      expect(row.provider).toBeTruthy();
    }
  });

  fnTest(["M06.F13.I01"], "I01 列表含 shared seed 的 oauth-001 / oauth-002 / oauth-003", async () => {
    const rows = await listOauth2Providers();
    const ids = rows.map((r) => r.id);
    expect(ids).toContain("oauth-001");
    expect(ids).toContain("oauth-002");
    expect(ids).toContain("oauth-003");
  });

  fnTest(["M06.F13.I01"], "I01 provider 字段覆盖 google / github / wechat", async () => {
    const rows = await listOauth2Providers();
    const providers = rows.map((r) => r.provider);
    expect(providers).toContain("google");
    expect(providers).toContain("github");
    expect(providers).toContain("wechat");
  });

  fnTest(["M06.F13.I01"], "I01 查询单个 OAuth2 提供商", async () => {
    const found = await getOauth2Provider("oauth-001");
    expect(found).toBeTruthy();
    expect(found!.name).toBe("Google");
    expect(found!.provider).toBe("google");
  });

  fnTest(["M06.F13.I01"], "I01 不存在 id 返回 null", async () => {
    const found = await getOauth2Provider("oauth-not-exist");
    expect(found).toBeNull();
  });

  fnTest(["M06.F13.I02"], "I02 新增 OAuth2 提供商（feishu）", async () => {
    const created = await createOauth2Provider({
      id: "oauth-test-feishu",
      name: "飞书",
      provider: "feishu",
      clientId: "feishu-client-id",
      enabled: true,
    });
    expect(created.id).toBe("oauth-test-feishu");
    expect(created.provider).toBe("feishu");

    const [row] = await db
      .select()
      .from(oauth2Providers)
      .where(eq(oauth2Providers.id, "oauth-test-feishu"));
    expect(row).toBeTruthy();
  });

  fnTest(["M06.F13.I02"], "I02 新增 OAuth2 提供商 clientId 可选", async () => {
    const created = await createOauth2Provider({
      id: "oauth-test-dingtalk",
      name: "钉钉",
      provider: "dingtalk",
      enabled: true,
    });
    expect(created.clientId).toBeNull();
  });

  fnTest(["M06.F13.I03"], "I03 编辑 OAuth2 提供商（改 name + 切换 enabled）", async () => {
    const updated = await updateOauth2Provider("oauth-test-feishu", {
      name: "飞书（企业版）",
      enabled: false,
    });
    expect(updated).toBeTruthy();
    expect(updated!.name).toBe("飞书（企业版）");
    expect(updated!.enabled).toBe(false);
    expect(updated!.provider).toBe("feishu");
  });

  fnTest(["M06.F13.I03"], "I03 编辑不存在的 OAuth2 提供商返回 null", async () => {
    const updated = await updateOauth2Provider("oauth-not-exist", {
      name: "x",
    });
    expect(updated).toBeNull();
  });

  fnTest(["M06.F13.I04"], "I04 删除 OAuth2 提供商", async () => {
    const deleted = await deleteOauth2Provider("oauth-test-dingtalk");
    expect(deleted).toBe(true);

    const after = await getOauth2Provider("oauth-test-dingtalk");
    expect(after).toBeNull();
  });

  fnTest(["M06.F13.I04"], "I04 删除不存在的 OAuth2 提供商返回 false", async () => {
    const deleted = await deleteOauth2Provider("oauth-not-exist");
    expect(deleted).toBe(false);
  });

  it("M06.F13 shared seed 中 oauth-002 (GitHub) 默认 enabled=true", async () => {
    const [row] = await db.select().from(oauth2Providers).where(eq(oauth2Providers.id, "oauth-002"));
    expect(row!.provider).toBe("github");
    expect(row!.enabled).toBe(true);
  });
});