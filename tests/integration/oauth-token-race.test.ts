// @vitest-environment node
// 5.123①② 竞态机制钉（tracker：rails 先行定形状，nextjs 同形镜像）。
//
// ① code claim 影响行数判定：并发输家（读到行但谓词删 0 行，returning 空投影）
//   必须 400 INVALID_GRANT 且不签发——修前 delete by id 无行数判定 → 200 照签（双花窗口）。
// ② rotate 轮换段原子：signToken 签发段故障必须回滚恢复旧 rt——同一 refresh 可重试；
//   修前 rotate 先删旧行，signToken 抛错留「旧废新未落」半态（内存 store 补偿回滚）。
import { describe, it, expect, vi, beforeEach } from "vitest";

const { dbMock, signTokenMock } = vi.hoisted(() => ({
  dbMock: {
    select: vi.fn(),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue(undefined) }),
    delete: vi.fn(),
  },
  signTokenMock: vi.fn(),
}));
vi.mock("@/db", () => ({ db: dbMock }));
vi.mock("@/lib/jwt", () => ({ signToken: signTokenMock }));

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

function mockClientFound() {
  dbMock.select.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: () => Promise.resolve([{ id: "app-row-id" }]),
      }),
    }),
  });
}

function mockCodeRow(overrides: Record<string, unknown> = {}) {
  dbMock.select.mockReturnValueOnce({
    from: () => ({
      where: () => ({
        limit: () =>
          Promise.resolve([
            {
              id: "code-row-id",
              code: "saas-code-race",
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

describe("5.123 oauth 竞态机制钉", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signTokenMock.mockReset();
    signTokenMock.mockResolvedValue("fake.jwt.access.token");
  });

  it("M04.F03.I02 并发输家 claim 删 0 行 → 400 INVALID_GRANT 不签发", async () => {
    mockClientFound();
    mockCodeRow();
    // 赢家已物理删行：谓词 claim 的 returning 空数组 = 删 0 行投影
    dbMock.delete.mockReturnValueOnce({
      where: () => ({ returning: () => Promise.resolve([]) }),
    });

    const res = await POST(
      makeReq({
        clientId: CLIENT_ID,
        grantType: "authorization_code",
        code: "saas-code-race",
        redirectUri: REDIRECT,
      }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_GRANT");
    // 输家不得签发新 token 对
    expect(json.refreshToken).toBeUndefined();
  });

  it("M04.F03.I03 signToken 故障 → 旧 refresh 必须可重试（轮换段回滚）", async () => {
    mockClientFound();
    const oldRefresh = "saas-rt-race-1";
    oauthStore.putRefresh(oldRefresh, {
      clientId: CLIENT_ID,
      userId: USER_ID,
      tenantId: TENANT_ID,
      scope: "openid",
    });
    // 注错：签发段故障（仅 signToken 抛出）
    signTokenMock.mockRejectedValueOnce(new Error("jwt secret missing"));

    const first = await POST(
      makeReq({
        clientId: CLIENT_ID,
        grantType: "refresh_token",
        refreshToken: oldRefresh,
      }) as never,
    );
    expect(first.status).toBeGreaterThanOrEqual(400);

    // 故障排除：同一 refresh 必须可重试（轮换段已回滚）
    mockClientFound();
    const retry = await POST(
      makeReq({
        clientId: CLIENT_ID,
        grantType: "refresh_token",
        refreshToken: oldRefresh,
      }) as never,
    );
    expect(retry.status).toBe(200);
    const json = await retry.json();
    expect(json.refreshToken).not.toBe(oldRefresh);
  });
});
