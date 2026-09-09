// @vitest-environment node
// M01.F04.I04 — /api/v1/auth/oidc/callback
//
// 直接调 Route Handler；mock @/db 避免真 Postgres；fnId 写进 test name。

import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  },
}));
vi.mock("@/db", () => ({ db: dbMock }));

import { POST } from "../../app/api/v1/auth/oidc/callback/route";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/v1/auth/oidc/callback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  code: "oidc-code-from-idp-12345",
  state: "abc-state",
  clientId: "00000000-0000-0000-0000-000000000aaa",
};

describe("M01.F04.I04 /api/v1/auth/oidc/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("M01.F04.I04 returns 200 TokenResponse for valid OIDC callback", async () => {
    // 9/7 后 schema：表名 apps → oauthClient，users → sysUser，
    // tenant 通过 tenantMember 解析（status=1=active）。
    const appUuid = "00000000-0000-0000-0000-000000000aaa";
    const userUuid = "00000000-0000-0000-0000-000000000bbb";
    const tenantUuid = "00000000-0000-0000-0000-000000000ccc";
    // 1) oauthClient 查询
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: appUuid, redirectUris: ["https://app.example.com/cb"] }]),
        }),
      }),
    });
    // 2) sysUser 查询（status=1=active）
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: userUuid }]),
        }),
      }),
    });
    // 3) tenantMember 查询（userId + status=1）
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ tenantId: tenantUuid }]),
        }),
      }),
    });

    const res = await POST(makeReq(validBody) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // HS256 3 segments
    expect(json.refreshToken).toMatch(/^saas-rt-/);
    expect(json.tokenType).toBe("Bearer");
    expect(json.expiresIn).toBe(3600);
    expect(json.scope).toBe("openid");
  });

  it("M01.F04.I04 returns 400 INVALID_REQUEST when fields missing", async () => {
    const res = await POST(makeReq({ code: "x" }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_REQUEST");
  });

  it("M01.F04.I04 returns 400 INVALID_CLIENT when clientId unknown", async () => {
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });

    const res = await POST(makeReq(validBody) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_CLIENT");
  });

  it("M01.F04.I04 returns 400 NO_USER when no active user", async () => {
    dbMock.select
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: "app-id-1", redirectUris: ["https://app.example.com/cb"] }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([]),
          }),
        }),
      });

    const res = await POST(makeReq(validBody) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("NO_USER");
  });
});