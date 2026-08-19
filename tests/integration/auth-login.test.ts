// @vitest-environment node
// M03.F01.I01 + M03.F01.I02 — /api/v1/auth/login
//
// v0.5.0 增加 lockout (loginLockout) + audit_events INSERT。

import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
  },
}));
vi.mock("@/db", () => ({ db: dbMock }));

import { POST } from "../../app/api/v1/auth/login/route";
import { loginLockout } from "../../src/lib/login-lockout";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("M03.F01.I01 + M03.F01.I02 /api/v1/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清空 lockout map（每个测试间隔离）
    for (const key of ["alice", "bob"]) loginLockout.clearFailures(key);
  });

  it("M03.F01.I01 returns 200 LoginResponse for valid credentials", async () => {
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                id: "user-id-1",
                tenantId: "00000000-0000-0000-0000-000000000111",
                status: "active",
                passwordHash: "plain:secret-pw",
              },
            ]),
        }),
      }),
    });

    const res = await POST(
      makeReq({ username: "alice", password: "secret-pw" }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // HS256 3 base64url segments
    expect(json.refreshToken).toBe("mock-refresh-user-id-1");
    expect(json.tokenType).toBe("Bearer");
    expect(json.expiresIn).toBe(3600);
    expect(json.userId).toBe("user-id-1");
    expect(json.currentTenantId).toBe("00000000-0000-0000-0000-000000000111");
  });

  it("M03.F01.I01 returns 401 UNAUTHORIZED for wrong password", async () => {
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                id: "user-id-1",
                tenantId: "t1",
                status: "active",
                passwordHash: "plain:secret-pw",
              },
            ]),
        }),
      }),
    });

    const res = await POST(
      makeReq({ username: "alice", password: "wrong-pw" }) as never,
    );
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("UNAUTHORIZED");
  });

  it("M03.F01.I02 returns 429 ACCOUNT_LOCKED after 5 consecutive failures", async () => {
    // 用户不存在 → 401，但 lockout 仍记录失败（按 username 计数）
    dbMock.select.mockReturnValue({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });

    for (let i = 0; i < 5; i++) {
      await POST(makeReq({ username: "bob", password: "x" }) as never);
    }
    const res = await POST(makeReq({ username: "bob", password: "x" }) as never);
    expect(res.status).toBe(429);
    const json = await res.json();
    expect(json.code).toBe("ACCOUNT_LOCKED");
  });

  it("M03.F01.I01 returns 400 BAD_REQUEST for invalid body", async () => {
    const res = await POST(makeReq({}) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("BAD_REQUEST");
  });
});