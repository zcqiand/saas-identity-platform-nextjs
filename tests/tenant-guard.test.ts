// @vitest-environment node
// Tenant-guard 单元测试：纯逻辑，无 DB 依赖。
// Phase 5：HS256 + jose 真签发。verifyPathTenant 现在 async，因为底层 verifyToken 是 async。
// 覆盖：缺失 token / 缺失 claim / mismatch / match / null pathTenantId / JwtParseError 透传。

import { describe, it, expect } from "vitest";
import {
  verifyPathTenant,
  tenantGuardErrorToResponse,
  TenantGuardError,
} from "@/lib/tenant-guard";
import { decodeJwtPayload, extractBearer, signTestToken } from "@/lib/jwt";

// 不验签的 legacy helper：仍用 alg:none 格式测 decodeJwtPayload 自身
function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function legacyJwt(claims: object): string {
  return `${b64url({ alg: "none" })}.${b64url(claims)}.dev`;
}

// HS256 真签发的 helper（用于 verifyPathTenant 系列测试）
async function hs256(claims: Record<string, unknown>): Promise<string> {
  return await signTestToken(claims);
}

describe("tenant-guard (M11.F04 — verifyPathTenant HS256 + jose)", () => {
  it("extractBearer returns token from 'Bearer xyz'", () => {
    expect(extractBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(extractBearer("bearer xyz")).toBe("xyz");
    expect(extractBearer(null)).toBeNull();
    expect(extractBearer(undefined)).toBeNull();
    expect(extractBearer("Basic xxx")).toBeNull();
  });

  it("decodeJwtPayload returns claims for valid JWT (legacy no-verify path)", () => {
    const claims = decodeJwtPayload(legacyJwt({ sub: "user-1", tenant_id: "t-1" }));
    expect(claims.sub).toBe("user-1");
    expect(claims.tenant_id).toBe("t-1");
  });

  it("verifyPathTenant returns claims when match", async () => {
    const token = await hs256({ sub: "user-1", tenant_id: "t-1" });
    const claims = await verifyPathTenant("t-1", `Bearer ${token}`);
    expect(claims.sub).toBe("user-1");
  });

  it("verifyPathTenant throws TenantGuardError on mismatch", async () => {
    const token = await hs256({ sub: "user-1", tenant_id: "t-1" });
    await expect(verifyPathTenant("t-2", `Bearer ${token}`)).rejects.toThrow(TenantGuardError);
  });

  it("verifyPathTenant throws when JWT missing tenant_id", async () => {
    const token = await hs256({ sub: "user-1" });
    await expect(verifyPathTenant("t-1", `Bearer ${token}`)).rejects.toThrow(/missing tenant_id/);
  });

  it("verifyPathTenant throws when no token", async () => {
    await expect(verifyPathTenant("t-1", null)).rejects.toThrow(/Missing or invalid Bearer/);
  });

  it("verifyPathTenant with null pathTenantId returns claims for any tenant_id", async () => {
    const token = await hs256({ sub: "user-1", tenant_id: "t-1" });
    const claims = await verifyPathTenant(null, `Bearer ${token}`);
    expect(claims.sub).toBe("user-1");
  });

  it("verifyPathTenant with null pathTenantId still requires token", async () => {
    await expect(verifyPathTenant(null, null)).rejects.toThrow(/Missing or invalid Bearer/);
  });

  it("verifyPathTenant throws TenantGuardError on alg:none token (Phase 5 真验签)", async () => {
    const legacy = legacyJwt({ sub: "user-1", tenant_id: "t-1" });
    await expect(verifyPathTenant("t-1", `Bearer ${legacy}`)).rejects.toThrow(TenantGuardError);
  });

  it("tenantGuardErrorToResponse returns 401 Response for TenantGuardError", () => {
    const e = new TenantGuardError("test");
    const resp = tenantGuardErrorToResponse(e);
    expect(resp).not.toBeNull();
    expect(resp?.status).toBe(401);
  });

  it("tenantGuardErrorToResponse returns null for non-guard errors", () => {
    expect(tenantGuardErrorToResponse(new Error("other"))).toBeNull();
    expect(tenantGuardErrorToResponse(null)).toBeNull();
  });
});