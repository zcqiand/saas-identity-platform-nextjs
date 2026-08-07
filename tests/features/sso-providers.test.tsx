/**
 * M06.F12 SSO 提供商（fn-ID M06.F12.I01-I04）
 *
 * 数据：sso_providers 表 CRUD（type ∈ "oidc" | "saml" | "cas"）。
 *
 * 覆盖：I01 列表 / I02 新增 / I03 编辑 / I04 删除
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  listSsoProviders,
  getSsoProvider,
  createSsoProvider,
  updateSsoProvider,
  deleteSsoProvider,
} from "@/lib/sso-provider-store";
import { seedDatabase } from "@/db/seed";
import { db } from "@/db";
import { ssoProviders } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fnTest } from "../fn";

beforeAll(async () => {
  await seedDatabase();
});

describe("M06.F12 SSO providers", () => {
  fnTest(["M06.F12.I01"], "I01 SSO 提供商列表（灌库后至少 1 行）", async () => {
    const rows = await listSsoProviders();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.name).toBeTruthy();
      expect(["oidc", "saml", "cas"]).toContain(row.type);
    }
  });

  fnTest(["M06.F12.I01"], "I01 列表含 shared seed 的 sso-001（oidc 类型）", async () => {
    const rows = await listSsoProviders();
    const sso1 = rows.find((r) => r.id === "sso-001");
    expect(sso1).toBeTruthy();
    expect(sso1!.type).toBe("oidc");
  });

  fnTest(["M06.F12.I01"], "I02 查询单个 SSO 提供商", async () => {
    const found = await getSsoProvider("sso-001");
    expect(found).toBeTruthy();
    expect(found!.name).toBe("企业 IDP");
  });

  fnTest(["M06.F12.I01"], "I02 不存在 id 返回 null", async () => {
    const found = await getSsoProvider("sso-not-exist");
    expect(found).toBeNull();
  });

  fnTest(["M06.F12.I02"], "I02 新增 SSO 提供商（saml 类型）", async () => {
    const created = await createSsoProvider({
      id: "sso-test-saml",
      name: "Test SAML IdP",
      type: "saml",
      clientId: "saml-client-001",
      issuerUrl: "https://saml.example.com",
      enabled: true,
    });
    expect(created.id).toBe("sso-test-saml");
    expect(created.type).toBe("saml");

    const [row] = await db.select().from(ssoProviders).where(eq(ssoProviders.id, "sso-test-saml"));
    expect(row).toBeTruthy();
  });

  fnTest(["M06.F12.I02"], "I02 新增 cas 类型 SSO 提供商", async () => {
    const created = await createSsoProvider({
      id: "sso-test-cas",
      name: "Test CAS IdP",
      type: "cas",
      enabled: false,
    });
    expect(created.type).toBe("cas");
    expect(created.clientId).toBeNull();
    expect(created.issuerUrl).toBeNull();
  });

  fnTest(["M06.F12.I03"], "I03 编辑 SSO 提供商（改 name + 禁用）", async () => {
    const updated = await updateSsoProvider("sso-test-saml", {
      name: "Test SAML IdP (Renamed)",
      enabled: false,
    });
    expect(updated).toBeTruthy();
    expect(updated!.name).toBe("Test SAML IdP (Renamed)");
    expect(updated!.enabled).toBe(false);
    expect(updated!.type).toBe("saml");
  });

  fnTest(["M06.F12.I03"], "I03 编辑不存在的 SSO 提供商返回 null", async () => {
    const updated = await updateSsoProvider("sso-not-exist", {
      name: "x",
    });
    expect(updated).toBeNull();
  });

  fnTest(["M06.F12.I04"], "I04 删除 SSO 提供商", async () => {
    const deleted = await deleteSsoProvider("sso-test-cas");
    expect(deleted).toBe(true);

    const after = await getSsoProvider("sso-test-cas");
    expect(after).toBeNull();
  });

  fnTest(["M06.F12.I04"], "I04 删除不存在的 SSO 提供商返回 false", async () => {
    const deleted = await deleteSsoProvider("sso-not-exist");
    expect(deleted).toBe(false);
  });

  it("M06.F12 type 字段约束：shared seed 中 sso-001 类型必须是 oidc/saml/cas 之一", async () => {
    const [row] = await db.select().from(ssoProviders).where(eq(ssoProviders.id, "sso-001"));
    expect(["oidc", "saml", "cas"]).toContain(row!.type);
  });
});