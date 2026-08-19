// JWT 签发 + 验签 — Phase 5（HS256 via jose）
//
// 与 springboot / aspnetcore 同款语义：
// - tenant_id claim 是 path :tenantId 比对的权威源
// - sub / NameIdentifier 是 user id
// - HS256 + JWT_SIGNING_KEY（env 镜像 springboot LAB_JWT_SECRET / aspnetcore Jwt.SigningKey）
// - iss = JWT_ISSUER / aud = JWT_AUDIENCE / exp = now + JWT_TTL_SECONDS

import "server-only";
import { SignJWT, jwtVerify, errors as joseErrors } from "jose";

export interface JwtClaims {
  sub?: string; // user id (UUID)
  tenant_id?: string; // tenant id (UUID)
  email?: string;
  scope?: string;
  iss?: string;
  aud?: string;
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

// ============================================================
// 配置（从 env 读，process 启动时校验）
// ============================================================

function readSigningKey(): Uint8Array {
  const key = process.env.JWT_SIGNING_KEY;
  if (!key || key.length < 32) {
    throw new Error(
      "JWT_SIGNING_KEY is missing or shorter than 32 bytes. Set env (see .env.example + ADR-0009).",
    );
  }
  return new TextEncoder().encode(key);
}

function readIssuer(): string {
  return process.env.JWT_ISSUER ?? "saas-identity-platform";
}

function readAudience(): string {
  return process.env.JWT_AUDIENCE ?? "saas-identity-platform-clients";
}

function readTtlSeconds(): number {
  const raw = process.env.JWT_TTL_SECONDS;
  const n = raw ? Number(raw) : 3600;
  return Number.isFinite(n) && n > 0 ? n : 3600;
}

// ============================================================
// 签发（HS256）
// ============================================================

export interface SignTokenInput {
  sub: string; // user id
  tenant_id: string; // tenant id
  scope?: string;
  email?: string;
  ttlSeconds?: number; // override default TTL（refresh / oauth 用 3600，switch tenant 可不同）
}

export async function signToken(input: SignTokenInput): Promise<string> {
  const key = readSigningKey();
  const ttl = input.ttlSeconds ?? readTtlSeconds();
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: input.sub,
    tenant_id: input.tenant_id,
    ...(input.scope ? { scope: input.scope } : {}),
    ...(input.email ? { email: input.email } : {}),
  };
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(readIssuer())
    .setAudience(readAudience())
    .setSubject(input.sub)
    .setIssuedAt(now)
    .setExpirationTime(now + ttl)
    .sign(key);
}

// ============================================================
// 验签（HS256）
// ============================================================

/** 验签 + 解码；token 无效 / 过期 / iss/aud 不匹配 → throw JwtParseError */
export async function verifyToken(token: string): Promise<JwtClaims> {
  const key = readSigningKey();
  try {
    const { payload } = await jwtVerify(token, key, {
      issuer: readIssuer(),
      audience: readAudience(),
    });
    return payload as JwtClaims;
  } catch (e) {
    // 所有验签失败一律包装为 JwtParseError（含 TypeError：jose 对 alg=none token 配 HS256 key 时抛 TypeError）
    const msg = e instanceof Error ? e.message : String(e);
    throw new JwtParseError(msg);
  }
}

/** 从 Authorization header 提取 bearer token；空 / 缺失返回 null */
export function extractBearer(authHeader: string | null | undefined): string | null {
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? (match[1]?.trim() ?? null) : null;
}

/** 端到端：Authorization header → claims；throw JwtParseError if invalid */
export async function claimsFromAuthHeader(
  authHeader: string | null | undefined,
): Promise<JwtClaims | null> {
  const token = extractBearer(authHeader);
  if (!token) return null;
  return await verifyToken(token);
}

// ============================================================
// Legacy：仅 base64url 解码（不验签；保留供 debug / 单元测试使用）
// ============================================================

/**
 * 不验签的 JWT payload 解码。**仅供 debug / 测试用例**。
 * 生产路径必须用 verifyToken 或 claimsFromAuthHeader。
 */
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

/** 测试辅助：用给定的 claims 签 HS256 token（单元测试用）。
 * 注意：tenant_id 可省略（用于「缺少 tenant_id claim」错误测试）；省略时 payload 中无 tenant_id 字段。 */
export async function signTestToken(claims: Record<string, unknown>): Promise<string> {
  const sub = String(claims.sub ?? "test-user");
  const key = readSigningKey();
  const now = Math.floor(Date.now() / 1000);
  const payload: Record<string, unknown> = { sub };
  if (claims.tenant_id !== undefined) payload.tenant_id = String(claims.tenant_id);
  if (claims.scope) payload.scope = String(claims.scope);
  if (claims.email) payload.email = String(claims.email);
  return await new (await import("jose")).SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(readIssuer())
    .setAudience(readAudience())
    .setSubject(sub)
    .setIssuedAt(now)
    .setExpirationTime(now + readTtlSeconds())
    .sign(key);
}