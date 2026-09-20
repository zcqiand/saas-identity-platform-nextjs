// @vitest-environment node
// M04.F03.I01 — /api/v1/oauth/authorize
//
// 直接调 Route Handler 函数；mock @/db 避免真 Postgres；fnId 写进 test name
// 让 tests/fnReporter.ts 正则提取，写入 .state/trace.json。
//
// 2026-09-15 收敛 4 家共同语义（本次修复的目标行为）：
//   1. 认证前置——Bearer 验签，缺/坏 → 401（msw/springboot/aspnetcore 同款；
//      此前 nextjs 无认证，是 lab SSO 400 的根因）。
//   2. body 不收 tenantId（shared tsp AuthorizeCodeRequest 无此字段）——code 绑定
//      Bearer 的 sub + tenant_id claim，不信 body（synthetic identity 禁令）。
//   3. redirect 白名单 = csv 精确或 '?' 前缀边界（aspnetcore 同款；DB 列是 csv 文本）。
//   4. code 落 oauth_code 表（client_id 存 code 形字符串，FK → oauth_client.client_id）。

import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock, insertValuesMock } = vi.hoisted(() => {
  const insertValuesMock = vi.fn().mockResolvedValue(undefined);
  return {
    insertValuesMock,
    dbMock: {
      select: vi.fn(),
      insert: vi.fn().mockReturnValue({ values: insertValuesMock }),
    },
  };
});
vi.mock("@/db", () => ({ db: dbMock }));

import { POST } from "../../src/app/api/v1/oauth/authorize/route";
import { signTestToken } from "@/lib/jwt";

const USER_ID = "00000000-0000-0000-0000-b00000000001";
const TENANT_ID = "00000000-0000-0000-0000-000000000001";

/** 登录页真实形状：契约 4 必填字段，无 tenantId（saas 三前端 login 跳板分支都不传）。 */
const loginPageBody = {
  clientId: "lab-management",
  redirectUri: "http://localhost:5201/login",
  responseType: "code" as const,
  scope: "lab.read lab.write",
  state: "xyz-state",
};

/** oauth_client.redirect_uris 在 DB 是 csv 文本（9/7 重组 text[]→varchar）。 */
const REDIRECT_CSV =
  "http://localhost:5201/callback,http://localhost:5201/login,http://localhost:5202/login";

function makeReq(body: unknown, authHeader?: string): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (authHeader) headers.authorization = authHeader;
  return new Request("http://localhost/api/v1/oauth/authorize", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

async function bearerToken(claims: Record<string, unknown> = {}): Promise<string> {
  return await signTestToken({
    sub: USER_ID,
    tenant_id: TENANT_ID,
    ...claims,
  });
}

/** db.select 两次查询的 mock：第 1 次 oauthClient，第 2 次 sysUser。 */
function mockClientAndUser(opts: { redirectCsv?: string; userRows?: unknown[] } = {}) {
  dbMock.select
    .mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () =>
            Promise.resolve([{ id: "app-row-id", redirectUris: opts.redirectCsv ?? REDIRECT_CSV }]),
        }),
      }),
    })
    .mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve(opts.userRows ?? [{ id: USER_ID }]),
        }),
      }),
    });
}

describe("M04.F03.I01 /api/v1/oauth/authorize", () => {
  beforeEach(() => {
    // mockReset（不是 clearAllMocks）：错误分支用例会提前 return，留下未消费的
    // mockReturnValueOnce；clear 不清 once 队列，会泄漏给下一用例当第 1 个 select
    // 消费（sysUser 形状被当 oauthClient → redirectUris undefined）。
    dbMock.select.mockReset();
    dbMock.insert.mockReset().mockReturnValue({ values: insertValuesMock });
    insertValuesMock.mockClear();
  });

  it("M04.F03.I01 Bearer + 登录页形状（无 tenantId）→ 200 { code, state }，code 落 oauth_code 表", async () => {
    mockClientAndUser();
    const res = await POST(makeReq(loginPageBody, `Bearer ${await bearerToken()}`) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.code).toMatch(/^saas-code-/);
    expect(json.state).toBe("xyz-state");
    // 落库：client_id 是 code 形字符串（FK → oauth_client.client_id），不是行 UUID
    expect(dbMock.insert).toHaveBeenCalledTimes(1);
    const insertArg = insertValuesMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(insertArg).toMatchObject({
      clientId: "lab-management",
      userId: USER_ID,
      tenantId: TENANT_ID,
      redirectUri: "http://localhost:5201/login",
      scope: "lab.read lab.write",
    });
    expect(String(insertArg.code)).toMatch(/^saas-code-/);
    expect(String(insertArg.expiresAt)).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("M04.F03.I01 body 多带 tenantId（contract-test/lab 消费端形状）→ 200，body tenantId 被忽略不拒收", async () => {
    mockClientAndUser();
    const res = await POST(
      makeReq(
        { ...loginPageBody, tenantId: "00000000-0000-0000-0000-000000000999" },
        `Bearer ${await bearerToken()}`,
      ) as never,
    );
    expect(res.status).toBe(200);
  });

  it("M04.F03.I01 白名单前缀 + '?query' 边界 → 200（RFC 6749 §3.1.2，lab 回跳带 ?from）", async () => {
    mockClientAndUser();
    const res = await POST(
      makeReq(
        { ...loginPageBody, redirectUri: "http://localhost:5201/login?from=/receipts" },
        `Bearer ${await bearerToken()}`,
      ) as never,
    );
    expect(res.status).toBe(200);
  });

  it("M04.F03.I01 无 Authorization → 401 UNAUTHORIZED（禁匿名签 code）", async () => {
    const res = await POST(makeReq(loginPageBody) as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("UNAUTHORIZED");
  });

  it("M04.F03.I01 坏 Bearer → 401 UNAUTHORIZED", async () => {
    const res = await POST(makeReq(loginPageBody, "Bearer not-a-jwt") as never);
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.code).toBe("UNAUTHORIZED");
  });

  it("M04.F03.I01 Bearer 缺 tenant_id claim → 401（tenant 必须来自认证身份，不信 body）", async () => {
    const token = await signTestToken({ sub: USER_ID }); // 无 tenant_id
    const res = await POST(
      makeReq({ ...loginPageBody, tenantId: TENANT_ID }, `Bearer ${token}`) as never,
    );
    expect(res.status).toBe(401);
  });

  it("M04.F03.I01 Bearer sub 不在 sys_user → 401（msw oracle『session user not found』同款）", async () => {
    mockClientAndUser({ userRows: [] });
    const token = await signTestToken({
      sub: "00000000-0000-0000-0000-b00000000999",
      tenant_id: TENANT_ID,
    });
    const res = await POST(makeReq(loginPageBody, `Bearer ${token}`) as never);
    expect(res.status).toBe(401);
  });

  it("M04.F03.I01 缺必填字段 → 400 INVALID_REQUEST", async () => {
    const res = await POST(makeReq({ clientId: "x" }, `Bearer ${await bearerToken()}`) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_REQUEST");
  });

  it("M04.F03.I01 responseType != 'code' → 400 UNSUPPORTED_RESPONSE_TYPE", async () => {
    const res = await POST(
      makeReq(
        { ...loginPageBody, responseType: "token" },
        `Bearer ${await bearerToken()}`,
      ) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("UNSUPPORTED_RESPONSE_TYPE");
  });

  it("M04.F03.I01 clientId 未注册 → 400 INVALID_CLIENT", async () => {
    dbMock.select.mockReturnValueOnce({
      from: () => ({
        where: () => ({
          limit: () => Promise.resolve([]),
        }),
      }),
    });
    const res = await POST(makeReq(loginPageBody, `Bearer ${await bearerToken()}`) as never);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_CLIENT");
  });

  it("M04.F03.I01 redirectUri 不在白名单 → 400 INVALID_REDIRECT_URI", async () => {
    mockClientAndUser();
    const res = await POST(
      makeReq(
        { ...loginPageBody, redirectUri: "https://evil.example.com/cb" },
        `Bearer ${await bearerToken()}`,
      ) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_REDIRECT_URI");
  });

  it("M04.F03.I01 白名单条目的子路径（无 '?' 边界）→ 400 INVALID_REDIRECT_URI（csv 语义，非子串匹配）", async () => {
    mockClientAndUser();
    // 'http://localhost:5201/call' 是 '/callback' 条目的前缀子串——旧 text.includes 误放行
    const res = await POST(
      makeReq(
        { ...loginPageBody, redirectUri: "http://localhost:5201/call" },
        `Bearer ${await bearerToken()}`,
      ) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_REDIRECT_URI");
  });
});
