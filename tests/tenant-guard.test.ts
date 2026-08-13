// Tenant-guard 单元测试：纯逻辑，无 DB 依赖。
// 覆盖：缺失 token / 缺失 claim / mismatch / match / null pathTenantId。

import { describe, it, expect } from "vitest";
import {
  verifyPathTenant,
  tenantGuardErrorToResponse,
  TenantGuardError,
} from "@/lib/tenant-guard";
import { decodeJwtPayload, extractBearer } from "@/lib/jwt";

function b64url(obj: object): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function jwt(claims: object): string {
  return `${b64url({ alg: "none" })}.${b64url(claims)}.dev`;
}

describe("tenant-guard (M11.F04)", () => {
  it("extractBearer returns token from 'Bearer xyz'", () => {
    expect(extractBearer("Bearer abc.def.ghi")).toBe("abc.def.ghi");
    expect(extractBearer("bearer xyz")).toBe("xyz");
    expect(extractBearer(null)).toBeNull();
    expect(extractBearer(undefined)).toBeNull();
    expect(extractBearer("Basic xxx")).toBeNull();
  });

  it("decodeJwtPayload returns claims for valid JWT", () => {
    const claims = decodeJwtPayload(jwt({ sub: "user-1", tenant_id: "t-1" }));
    expect(claims.sub).toBe("user-1");
    expect(claims.tenant_id).toBe("t-1");
  });

  it("verifyPathTenant returns claims when match", () => {
    const token = jwt({ sub: "user-1", tenant_id: "t-1" });
    const claims = verifyPathTenant("t-1", `Bearer ${token}`);
    expect(claims.sub).toBe("user-1");
  });

  it("verifyPathTenant throws TenantGuardError on mismatch", () => {
    const token = jwt({ sub: "user-1", tenant_id: "t-1" });
    expect(() => verifyPathTenant("t-2", `Bearer ${token}`)).toThrow(TenantGuardError);
  });

  it("verifyPathTenant throws when JWT missing tenant_id", () => {
    const token = jwt({ sub: "user-1" });
    expect(() => verifyPathTenant("t-1", `Bearer ${token}`)).toThrow(/missing tenant_id/);
  });

  it("verifyPathTenant throws when no token", () => {
    expect(() => verifyPathTenant("t-1", null)).toThrow(/Missing or invalid Bearer/);
  });

  it("verifyPathTenant with null pathTenantId returns claims for any tenant_id", () => {
    const token = jwt({ sub: "user-1", tenant_id: "t-1" });
    const claims = verifyPathTenant(null, `Bearer ${token}`);
    expect(claims.sub).toBe("user-1");
  });

  it("verifyPathTenant with null pathTenantId still requires token", () => {
    expect(() => verifyPathTenant(null, null)).toThrow(/Missing or invalid Bearer/);
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