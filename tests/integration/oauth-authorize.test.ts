// M04.F03.I07 — /api/v1/oauth/authorize
//
// 直接调 Route Handler 函数；mock @/db 避免真 Postgres；fnId 写进 test name
// 让 tests/fnReporter.ts 正则提取，写入 .state/trace.json。

import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  },
}));
vi.mock("@/db", () => ({ db: dbMock }));

import { POST } from "../../app/api/v1/oauth/authorize/route";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/v1/oauth/authorize", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  clientId: "00000000-0000-0000-0000-000000000aaa",
  redirectUri: "https://app.example.com/callback",
  responseType: "code" as const,
  scope: "openid profile",
  state: "xyz-state",
  tenantId: "00000000-0000-0000-0000-000000000111",
};

describe("M04.F03.I07 /api/v1/oauth/authorize", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("M04.F03.I07 returns 200 { code, state } for valid request", async () => {
    dbMock.select
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: "app-id-1", redirectUris: ["https://app.example.com/callback"] }]),
          }),
        }),
      })
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: "user-id-1" }]),
          }),
        }),
      });

    const res = await POST(makeReq(validBody) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toMatch(/^saas-code-/);
    expect(json.state).toBe("xyz-state");
  });

  it("M04.F03.I07 returns 400 INVALID_REQUEST when fields missing", async () => {
    const res = await POST(makeReq({ clientId: "x" }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_REQUEST");
  });

  it("M04.F03.I07 returns 400 UNSUPPORTED_RESPONSE_TYPE when not 'code'", async () => {
    const res = await POST(makeReq({ ...validBody, responseType: "token" }) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("UNSUPPORTED_RESPONSE_TYPE");
  });

  it("M04.F03.I07 returns 400 INVALID_CLIENT when clientId unknown", async () => {
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

  it("M04.F03.I07 returns 400 INVALID_REDIRECT_URI when redirectUri not in whitelist", async () => {
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: "app-id-1", redirectUris: ["https://other.example.com/cb"] }]),
        }),
      }),
    });

    const res = await POST(makeReq(validBody) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_REDIRECT_URI");
  });

  it("M04.F03.I07 returns 400 NO_USER when tenant has no user", async () => {
    dbMock.select
      .mockReturnValueOnce({
        from: () => ({
          where: () => ({
            limit: () => Promise.resolve([{ id: "app-id-1", redirectUris: ["https://app.example.com/callback"] }]),
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