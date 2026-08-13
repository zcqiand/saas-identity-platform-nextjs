// Tenant guard — Route Handler / Server Action 第一行必调
//
// 语义与 springboot TenantGuard / aspnetcore TenantGuard 一致：
// - 路径 :tenantId（动态段）与 JWT `tenant_id` claim 比对
// - 不匹配 → throw new TenantGuardError（Route Handler catch 后返回 401）
// - 缺失 :tenantId 或缺失 claim → 不调 guard，由具体 endpoint 决定是否需要

import "server-only";
import { claimsFromAuthHeader, JwtClaims } from "./jwt";

export { claimsFromAuthHeader, JwtParseError } from "./jwt";

export class TenantGuardError extends Error {
  readonly status = 401;
  constructor(message: string) {
    super(message);
    this.name = "TenantGuardError";
  }
}

/**
 * 校验 :tenantId 与 JWT claim 一致。
 *
 * @param pathTenantId - URL 路径参数；null 表示本 endpoint 不需要 tenant scope
 * @param authHeader - 原始 Authorization header（不是 Bearer token）
 * @returns JwtClaims（让 caller 后续用 sub / email 等）
 * @throws TenantGuardError 当：
 *   - pathTenantId 给出但 JWT 无 tenant_id claim
 *   - JWT tenant_id 与 pathTenantId 不一致
 */
export function verifyPathTenant(
  pathTenantId: string | null,
  authHeader: string | null | undefined,
): JwtClaims {
  const claims = claimsFromAuthHeader(authHeader);
  if (!claims) {
    throw new TenantGuardError("Missing or invalid Bearer token");
  }

  if (pathTenantId === null) {
    // 不需要 tenant scope 的端点（如 /api/v1/me、/api/v1/auth/login）；只要 JWT 存在即可
    return claims;
  }

  const tokenTenantId = claims.tenant_id;
  if (!tokenTenantId) {
    throw new TenantGuardError("JWT missing tenant_id claim");
  }

  if (tokenTenantId !== pathTenantId) {
    throw new TenantGuardError(
      `tenant_id mismatch: path=${pathTenantId} token=${tokenTenantId}`,
    );
  }

  return claims;
}

/** 把 TenantGuardError 转成 Response（供 Route Handler catch 用） */
export function tenantGuardErrorToResponse(e: unknown): Response | null {
  if (e instanceof TenantGuardError) {
    return new Response(
      JSON.stringify({ code: "UNAUTHORIZED", message: e.message }),
      { status: e.status, headers: { "content-type": "application/json" } },
    );
  }
  return null;
}

/** 同上但包成 NextResponse（Route Handler 返回类型兼容） */
export function tenantGuardErrorToNextResponse(e: unknown): import("next/server").NextResponse | null {
  const r = tenantGuardErrorToResponse(e);
  if (!r) return null;
  // Route Handler catch 块把 Response 当 NextResponse 用是合法的（Next 内部同构）；
  // 但 TS 类型不兼容，需要 cast。
  return r as unknown as import("next/server").NextResponse;
}