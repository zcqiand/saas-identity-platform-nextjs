// M04.F03.I08 + M04.F03.I09 — /api/v1/oauth/token
//
// 覆盖：authorization_code / refresh_token 两条 grantType 路径 + 各种 400 错误码。
// fnId 写进 test name 让 tests/fnReporter.ts 提取。

import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  },
}));
vi.mock("@/db", () => ({ db: dbMock }));

import { POST } from "../../app/api/v1/oauth/token/route";
import { oauthStore } from "../../src/lib/oauth-store";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/v1/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  clientId: "00000000-0000-0000-0000-000000000aaa",
  tenantId: "00000000-0000-0000-0000-000000000111",
};

describe("M04.F03.I08 /api/v1/oauth/token (authorization_code + refresh_token)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 重置 oauth-store maps（每个测试间清理）
    // store 是单例，但 putCode/consumeCode 是测试间独立操作的；
    // 通过 unique code/refreshToken 避免串扰即可
  });

  it("M04.F03.I08 returns 200 TokenResponse for valid authorization_code", async () => {
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "app-id-1" }]),
        }),
      }),
    });
    // 预置一个 code
    const code = `saas-code-test-${Date.now()}-1`;
    oauthStore.putCode(code, {
      appId: "app-id-1",
      userId: "user-id-1",
      tenantId: baseBody.tenantId,
      scope: "openid",
      redirectUri: "https://app.example.com/callback",
    });

    const res = await POST(
      makeReq({
        ...baseBody,
        grantType: "authorization_code",
        code,
        redirectUri: "https://app.example.com/callback",
      }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accessToken).toMatch(/^saas-jwt-/);
    expect(json.refreshToken).toMatch(/^saas-rt-/);
    expect(json.tokenType).toBe("Bearer");
    expect(json.expiresIn).toBe(3600);
    expect(json.scope).toBe("openid");
  });

  it("M04.F03.I08 returns 400 INVALID_GRANT when code unknown", async () => {
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "app-id-1" }]),
        }),
      }),
    });
    const res = await POST(
      makeReq({
        ...baseBody,
        grantType: "authorization_code",
        code: "nonexistent",
        redirectUri: "https://app.example.com/callback",
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_GRANT");
  });

  it("M04.F03.I09 returns 200 rotated TokenResponse for valid refresh_token", async () => {
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "app-id-1" }]),
        }),
      }),
    });
    const oldRefresh = `saas-rt-test-${Date.now()}-2`;
    oauthStore.putRefresh(oldRefresh, {
      appId: "app-id-1",
      userId: "user-id-1",
      tenantId: baseBody.tenantId,
      scope: "openid",
    });

    const res = await POST(
      makeReq({
        ...baseBody,
        grantType: "refresh_token",
        refreshToken: oldRefresh,
      }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accessToken).toMatch(/^saas-jwt-/);
    expect(json.refreshToken).not.toBe(oldRefresh); // rotated
  });

  it("M04.F03.I09 returns 400 INVALID_GRANT when refreshToken unknown", async () => {
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "app-id-1" }]),
        }),
      }),
    });
    const res = await POST(
      makeReq({
        ...baseBody,
        grantType: "refresh_token",
        refreshToken: "nonexistent",
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_GRANT");
  });

  it("M04.F03.I08 returns 400 INVALID_CLIENT when clientId unknown", async () => {
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });
    const res = await POST(
      makeReq({
        ...baseBody,
        grantType: "authorization_code",
        code: "x",
        redirectUri: "https://app.example.com/cb",
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_CLIENT");
  });

  it("M04.F03.I08 returns 400 UNSUPPORTED_GRANT_TYPE for unknown grant", async () => {
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "app-id-1" }]),
        }),
      }),
    });
    const res = await POST(
      makeReq({ ...baseBody, grantType: "password" }) as never,
    );
    // Zod enum 拦截，INVALID_REQUEST
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(["INVALID_REQUEST", "UNSUPPORTED_GRANT_TYPE"]).toContain(json.code);
  });
});