// @vitest-environment node
// M03.F03.I05 — /api/v1/auth/logout
//
// 最佳努力 204：即便 Authorization header 无效 / 缺失也返回 204（防泄露 token 状态）。
// 不写 audit（AuditAction 枚举里没有 logout，与 msw handler-extra.ts:291-294 镜像）。

import { describe, it, expect } from "vitest";

import { POST } from "../../app/api/v1/auth/logout/route";

function makeReq(authHeader?: string): Request {
  const headers: Record<string, string> = {};
  if (authHeader) headers["authorization"] = authHeader;
  return new Request("http://localhost/api/v1/auth/logout", {
    method: "POST",
    headers,
  });
}

describe("M03.F03.I05 /api/v1/auth/logout", () => {
  it("M03.F03.I05 returns 204 with valid Authorization header", async () => {
    const res = await POST(makeReq("Bearer mock-jwt-user-1") as never);
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
  });

  it("M03.F03.I05 returns 204 even with invalid Authorization header", async () => {
    const res = await POST(makeReq("Bearer invalid.token.xyz") as never);
    expect(res.status).toBe(204);
  });

  it("M03.F03.I05 returns 204 with no Authorization header", async () => {
    const res = await POST(makeReq() as never);
    expect(res.status).toBe(204);
  });
});