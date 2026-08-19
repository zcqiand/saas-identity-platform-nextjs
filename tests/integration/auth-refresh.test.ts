// @vitest-environment node
// M03.F02.I04 — /api/v1/auth/refresh
//
// v0.5.0 切到 oauth-store.rotateRefresh；与 /oauth/token grantType=refresh_token 同款语义。

import { describe, it, expect, vi, beforeEach } from "vitest";
import { oauthStore } from "../../src/lib/oauth-store";

import { POST } from "../../app/api/v1/auth/refresh/route";

function makeReq(body: unknown): Request {
  return new Request("http://localhost/api/v1/auth/refresh", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const baseBody = {
  grantType: "refresh_token" as const,
  clientId: "00000000-0000-0000-0000-000000000aaa",
  tenantId: "00000000-0000-0000-0000-000000000111",
};

describe("M03.F02.I04 /api/v1/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("M03.F02.I04 returns 200 rotated TokenResponse for valid refresh_token", async () => {
    const oldRefresh = `saas-rt-test-${Date.now()}-refresh`;
    oauthStore.putRefresh(oldRefresh, {
      appId: "app-id-1",
      userId: "user-id-1",
      tenantId: baseBody.tenantId,
      scope: "openid",
    });

    const res = await POST(makeReq({ ...baseBody, refreshToken: oldRefresh }) as never);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/); // HS256 3 segments
    expect(json.refreshToken).not.toBe(oldRefresh);
    expect(json.refreshToken).toMatch(/^saas-rt-/);
  });

  it("M03.F02.I04 returns 400 INVALID_GRANT when refreshToken unknown", async () => {
    const res = await POST(
      makeReq({ ...baseBody, refreshToken: "nonexistent" }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_GRANT");
  });

  it("M03.F02.I04 returns 400 when tenantId mismatches", async () => {
    const rt = `saas-rt-test-${Date.now()}-mismatch`;
    oauthStore.putRefresh(rt, {
      appId: "app-id-1",
      userId: "user-id-1",
      tenantId: "00000000-0000-0000-0000-000000000111",
      scope: "openid",
    });

    const res = await POST(
      makeReq({ ...baseBody, refreshToken: rt, tenantId: "00000000-0000-0000-0000-000000000222" }) as never,
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.code).toBe("INVALID_GRANT");
  });

  it("M03.F02.I04 returns 400 when grantType not refresh_token", async () => {
    const res = await POST(
      makeReq({ ...baseBody, grantType: "authorization_code" as never }) as never,
    );
    expect(res.status).toBe(400);
  });
});