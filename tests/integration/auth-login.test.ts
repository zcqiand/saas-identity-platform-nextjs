// @vitest-environment node
// M01.F04.I03 + M01.F04.I02 — /api/v1/auth/login
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

import { POST } from "../../src/app/api/v1/auth/login/route";
import { loginLockout } from "../../src/lib/login-lockout";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/v1/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("M01.F04.I03 + M01.F04.I02 /api/v1/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 清空 lockout map（每个测试间隔离）
    for (const key of ["alice", "bob"]) loginLockout.clearFailures(key);
  });

  it("M01.F04.I03 returns 200 LoginResponse for valid credentials", async () => {
    // 9/7 后 schema：sysUser 表无 passwordHash，password 直接放列；
    // 用户 tenantId 不存在 sysUser 上，需走 tenantMember 解析（status=1=active）。
    const tenantUuid = "00000000-0000-0000-0000-000000000111";
    // 1) sysUser 查询
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([
              {
                id: "user-id-1",
                status: 1,
                password: "plain:secret-pw",
                // 2026-09-12 四方对齐：login 出参时间戳走 toISOString，mock 行需带时间列
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
              },
            ]),
        }),
      }),
    });
    // 2) tenantMember 查询（按 userId + status=1）。
    // 2026-09-12 契约测试修复：解析「当前租户」必须确定性排序
    // （tenant.created_at ASC + id tie-break），mock 桩同步 innerJoin+orderBy 链。
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        innerJoin: () => ({
          where: () => ({
            orderBy: () => ({
              limit: () => Promise.resolve([{ tenantId: tenantUuid }]),
            }),
          }),
        }),
      }),
    });
    // 3) tenant 校验（status=1=active）
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([{ id: tenantUuid, status: 1 }]),
        }),
      }),
    });
    // 4) availableTenants：tenantMember ⨝ tenant_application（ADR-0032 扁平行）
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        innerJoin: () => ({
          where: () =>
            Promise.resolve([
              {
                id: "member-id-1",
                userId: "user-id-1",
                tenantId: tenantUuid,
                joinedAt: "2026-01-01T00:00:00Z",
              },
            ]),
        }),
      }),
    });
    // 5) roleIds 真值链：tenant_member_role ⨝ sys_role
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        innerJoin: () => ({
          where: () => Promise.resolve([]),
        }),
      }),
    });

    const res = await POST(
      makeReq({ username: "alice", password: "secret-pw" }) as never,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // HS256 3 base64url segments
    // 2026-09-01 I24 修复后 refreshToken 走 generateRefreshToken（saas-rt- 前缀 + rotate 语义）
    expect(json.refreshToken).toMatch(/^saas-rt-user-id-1-/);
    expect(json.tokenType).toBe("Bearer");
    expect(json.expiresIn).toBe(3600);
    expect(json.userId).toBe("user-id-1");
    expect(json.currentTenantId).toBe(tenantUuid);
    // ADR-0032 LoginResponse required：user / availableTenants / clientId
    expect(json.user?.id).toBe("user-id-1");
    expect(Array.isArray(json.availableTenants)).toBe(true);
    expect(json.availableTenants?.[0]).toMatchObject({
      id: "member-id-1",
      userId: "user-id-1",
      tenantId: tenantUuid,
      roleIds: [],
      status: "active",
      // toISOString 序列化：毫秒精度 + Z 后缀（msw oracle 同形）
      joinedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(json.clientId).toBe("");
  });

  it("M01.F04.I03 returns 401 UNAUTHORIZED for wrong password", async () => {
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
    // 2026-09-02 contract-test M96 audit 覆盖对齐（用户拍板）：login 失败不写 login_failed
    // （msw/springboot/aspnetcore 均不写；lockout 计数仍走内存 loginLockout，不依赖 audit 表）
    expect(dbMock.insert, "login 失败不得写 audit_events（对齐 3 真后端）").not.toHaveBeenCalled();
  });

  it("M01.F04.I02 returns 429 ACCOUNT_LOCKED after 5 consecutive failures", async () => {
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
    // 同上：全程失败路径，不写任何 audit 事件
    expect(dbMock.insert, "lockout 路径不得写 audit_events").not.toHaveBeenCalled();
  });

  it("M01.F04.I03 returns 400 BAD_REQUEST for invalid body", async () => {
    const res = await POST(makeReq({}) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("BAD_REQUEST");
  });
});