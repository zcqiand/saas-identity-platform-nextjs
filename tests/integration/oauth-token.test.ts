// @vitest-environment node
// M04.F03.I02 + M04.F03.I03 — /api/v1/oauth/token
//
// 覆盖：authorization_code / refresh_token 两条 grantType 路径 + 各种 400 错误码。
// fnId 写进 test name 让 tests/fnReporter.ts 提取。
//
// 2026-09-15 收敛：tenantId 不是 TokenRequest 字段（shared tsp）——不再 zod 必填、
// 不再比对（user/tenant 一律取 oauth_code 行绑定值）；code 自本日起落 oauth_code 表。

import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue(undefined) }),
  },
}));
vi.mock("@/db", () => ({ db: dbMock }));

import { POST } from "../../src/app/api/v1/oauth/token/route";
import { oauthStore } from "../../src/lib/oauth-store";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/v1/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const CLIENT_ID = "lab-management";
const USER_ID = "00000000-0000-0000-0000-b00000000001";
const TENANT_ID = "00000000-0000-0000-0000-000000000001";
const REDIRECT = "http://localhost:5201/callback";

/** lab 后端消费端真实形状：无 tenantId（shared tsp TokenRequest 无此字段）。 */
const baseBody = {
  clientId: CLIENT_ID,
};

function mockClientFound() {
  dbMock.select.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([{ id: "app-row-id" }]),
      }),
    }),
  });
}

/** oauth_code 行（authorize 落库形状）。 */
function mockCodeRow(overrides: Record<string, unknown> = {}) {
  dbMock.select.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: () =>
          Promise.resolve([
            {
              id: "code-row-id",
              code: "saas-code-x",
              clientId: CLIENT_ID,
              userId: USER_ID,
              tenantId: TENANT_ID,
              redirectUri: REDIRECT,
              scope: "lab.read",
              expiresAt: new Date(Date.now() + 600_000).toISOString(),
              ...overrides,
            },
          ]),
      }),
    }),
  });
}

describe("M04.F03.I02 /api/v1/oauth/token (authorization_code + refresh_token)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("M04.F03.I02 returns 200 TokenResponse for valid authorization_code（无 body tenantId）", async () => {
    mockClientFound();
    mockCodeRow({ code: "saas-code-live-1" });

    const res = await POST(
      makeReq({
        ...baseBody,
        grantType: "authorization_code",
        code: "saas-code-live-1",
        redirectUri: REDIRECT,
      }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // HS256 3 segments
    expect(json.refreshToken).toMatch(/^saas-rt-/);
    expect(json.tokenType).toBe("Bearer");
    expect(json.expiresIn).toBe(3600);
    expect(json.scope).toBe("lab.read");
    // 一次性消费：code 行被删
    expect(dbMock.delete).toHaveBeenCalled();
  });

  it("M04.F03.I02 body 多带 tenantId（错值）→ 仍 200（tenantId 非契约字段，取 code 行绑定值）", async () => {
    mockClientFound();
    mockCodeRow({ code: "saas-code-live-2" });

    const res = await POST(
      makeReq({
        ...baseBody,
        grantType: "authorization_code",
        code: "saas-code-live-2",
        redirectUri: REDIRECT,
        tenantId: "00000000-0000-0000-0000-000000000999",
      }) as never,
    );
    expect(res.status).toBe(200);
  });

  it("M04.F03.I02 returns 400 INVALID_GRANT when code unknown", async () => {
    mockClientFound();
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
        code: "nonexistent",
        redirectUri: REDIRECT,
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_GRANT");
  });

  it("M04.F03.I02 code 过期 → 400 INVALID_GRANT 且删行", async () => {
    mockClientFound();
    mockCodeRow({ code: "saas-code-expired", expiresAt: new Date(Date.now() - 1000).toISOString() });
    const res = await POST(
      makeReq({
        ...baseBody,
        grantType: "authorization_code",
        code: "saas-code-expired",
        redirectUri: REDIRECT,
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_GRANT");
    expect(dbMock.delete).toHaveBeenCalled();
  });

  it("M04.F03.I02 redirectUri 与 authorize 时不一致 → 400 INVALID_GRANT（RFC 6749 §4.1.3）", async () => {
    mockClientFound();
    mockCodeRow({ code: "saas-code-mismatch" });
    const res = await POST(
      makeReq({
        ...baseBody,
        grantType: "authorization_code",
        code: "saas-code-mismatch",
        redirectUri: "https://evil.example.com/cb",
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_GRANT");
  });

  it("M04.F03.I03 returns 200 rotated TokenResponse for valid refresh_token", async () => {
    mockClientFound();
    const oldRefresh = `saas-rt-test-${Date.now()}-2`;
    oauthStore.putRefresh(oldRefresh, {
      clientId: CLIENT_ID,
      userId: USER_ID,
      tenantId: TENANT_ID,
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
    expect(json.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // HS256 3 segments
    expect(json.refreshToken).not.toBe(oldRefresh); // rotated
  });

  it("M04.F03.I03 returns 400 INVALID_GRANT when refreshToken unknown", async () => {
    mockClientFound();
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

  it("M04.F03.I02 returns 400 INVALID_CLIENT when clientId unknown", async () => {
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
        redirectUri: REDIRECT,
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_CLIENT");
  });

  it("M04.F03.I02 returns 400 UNSUPPORTED_GRANT_TYPE for unknown grant", async () => {
    mockClientFound();
    const res = await POST(
      makeReq({ ...baseBody, grantType: "password" }) as never,
    );
    // Zod enum 拦截，INVALID_REQUEST
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(["INVALID_REQUEST", "UNSUPPORTED_GRANT_TYPE"]).toContain(json.code);
  });
});
