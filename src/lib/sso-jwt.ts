/**
 * M03.F02 身份集成 - SSO JWT 签发与验签
 *
 * 与 saas 自家 admin console 的 auth-store.ts（payload 走 userId/tenantId，cookie 名 saas_session）
 * 隔离：本文件只服务 OAuth 委托场景（lab 侧 → saas → 回调换 token）。
 *
 * 关键差异（与 saas 仓 admin auth-store 对比）：
 *   - payload 走 OAuth 标准 claim（sub/username/orgId/tenantId/appId/roles/permissions/exp/iat）
 *   - 签发密钥与 admin 不同（process.env.SSO_JWT_SECRET）—— 即使 admin 密钥泄露，委托 token 仍安全
 *   - 验签用 jose.jwtVerify（标准 JWT），便于第三方对接（lab 端可用任何 JWT 库验）
 *
 * 重要：mock 模式下 token 仅 dev 用，不带 PKCE/state 签名，prod 需补 PKCE + state=HMAC 签名。
 */
import { SignJWT, jwtVerify } from "jose";

const SSO_JWT_SECRET = process.env.SSO_JWT_SECRET ?? "dev-sso-secret-not-for-prod";
const ISSUER = "saas-identity-platform-nextjs";
const TTL_SECONDS = 3600;

/** 业务字段集合（与 JWT 索引签名解耦；不在 jose JWTPayload 上扩展以避免 unknown 冲突） */
export interface SsoClaims {
  /** 用户 ID（OAuth 标准 sub） */
  sub: string;
  /** 用户名 */
  username: string;
  /** 用户显示名（lab UI 展示用） */
  displayName: string;
  /** 部门 ID（v0.3.0 重命名：原 orgId → departmentId；lab 部门根 = org-lab-root，1:1 对应 tenant-lab） */
  departmentId: string;
  /** 租户 ID */
  tenantId: string;
  /** 登录来源应用 ID（lab = 'app-lab'） */
  appId: string;
  /** 角色 ID 列表（lab 仓 = ['role-lab-admin']） */
  roles: string[];
  /** 业务权限码（project:read / sample:write / report:issue 等） */
  permissions: string[];
}

/** 验签后返回的完整 payload（含 jose 标准 iat/exp） */
export interface SsoPayload extends SsoClaims {
  iat: number;
  exp: number;
  iss: string;
}

function getSecret(): Uint8Array {
  return new TextEncoder().encode(SSO_JWT_SECRET);
}

export async function signSsoToken(claims: SsoClaims): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({
    sub: claims.sub,
    username: claims.username,
    displayName: claims.displayName,
    departmentId: claims.departmentId,
    tenantId: claims.tenantId,
    appId: claims.appId,
    roles: claims.roles,
    permissions: claims.permissions,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SECONDS)
    .setIssuer(ISSUER)
    .sign(getSecret());
}

export async function verifySsoToken(token: string): Promise<SsoPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { issuer: ISSUER });
    return payload as unknown as SsoPayload;
  } catch {
    return null;
  }
}
