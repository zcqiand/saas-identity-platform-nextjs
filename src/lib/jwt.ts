// JWT 解析：Bearer token → claims
//
// 与 springboot / aspnetcore 同样语义：
// - tenant_id claim 是 path :tenantId 比对的权威源
// - sub / NameIdentifier 是 user id
//
// 注：本仓只 verify signature 不签发；签发由后续 phase 加（HS256/RS256 + signing key）。
// 当前实现：仅 base64url 解析 payload（不验签），与 TypeSpec LoginResponse.accessToken 字段对齐；
// 完整验签留 Phase 5 后续。生产前必须加 jose/jsonwebtoken 验签。

import "server-only";

export interface JwtClaims {
  sub?: string;          // user id (UUID)
  tenant_id?: string;    // tenant id (UUID)
  email?: string;
  scope?: string;
        // exp / iat 由上游 token 颁发方填；本仓暂不强制校验过期
  exp?: number;
  iat?: number;
  [key: string]: unknown;
}

export class JwtParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtParseError";
  }
}

/** 从 Authorization header 提取 bearer token；空 / 缺失返回 null */
export function extractBearer(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? (match[1]?.trim() ?? null) : null;
}

/** 解析 JWT payload（不验签；仅 base64url 解码） */
export function decodeJwtPayload(token: string): JwtClaims {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new JwtParseError(`JWT expected 3 parts, got ${parts.length}`);
  }
  const payload = parts[1];
  if (!payload) {
    throw new JwtParseError("JWT payload segment missing");
  }
  const padded = payload.replace(/-/g, "+").replace(/_/g, "/");
  const json = Buffer.from(padded, "base64").toString("utf-8");
  try {
    return JSON.parse(json) as JwtClaims;
  } catch (e) {
    throw new JwtParseError(`JWT payload not valid JSON: ${(e as Error).message}`);
  }
}

/** 端到端：Authorization header → claims；throw JwtParseError if invalid */
export function claimsFromAuthHeader(authHeader: string | null | undefined): JwtClaims | null {
  const token = extractBearer(authHeader);
  if (!token) return null;
  return decodeJwtPayload(token);
}