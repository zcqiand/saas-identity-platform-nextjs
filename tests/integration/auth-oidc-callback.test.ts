// M03.F02.I03 — /api/v1/auth/oidc/callback
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

describe("M03.F02.I03 /api/v1/auth/oidc/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("M03.F02.I03 returns 200 TokenResponse for valid OIDC callback", async () => {
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
            limit: () => Promise.resolve([{ id: "user-id-1", tenantId: "00000000-0000-0000-0000-000000000111" }]),
          }),
        }),
      });

    const res = await POST(makeReq(validBody) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accessToken).toMatch(/^saas-jwt-/);
    expect(json.refreshToken).toMatch(/^saas-rt-/);
    expect(json.tokenType).toBe("Bearer");
    expect(json.expiresIn).toBe(3600);
    expect(json.scope).toBe("openid");
  });

  it("M03.F02.I03 returns 400 INVALID_REQUEST when fields missing", async () => {
    const res = await POST(makeReq({ code: "x" }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_REQUEST");
  });

  it("M03.F02.I03 returns 400 INVALID_CLIENT when clientId unknown", async () => {
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

  it("M03.F02.I03 returns 400 NO_USER when no active user", async () => {
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