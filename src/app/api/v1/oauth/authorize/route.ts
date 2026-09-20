// /api/v1/oauth/authorize — M04.F03.I01
//
// TypeSpec: AuthorizeCodeRequest { clientId, redirectUri, responseType: "code", scope?, state }
// 响应：{ code, state }（自定义 inline schema；openapi.yaml:778-786）
//
// 语义（镜像 saas-identity-platform-msw/src/handlers-extra.ts:730-824）：
// - 先认证：Bearer 验签（msw 是 session 或 Bearer 双通道；nextjs 无 saas session
//   cookie，等价收敛为 Bearer 单通道），缺/坏 → 401 UNAUTHORIZED
// - 缺 clientId/redirectUri/responseType/state → 400 INVALID_REQUEST
//   （tenantId 不是契约字段——2026-09-15 收敛，此前 zod 必填导致登录页跳板分支
//   authorize 必 400，lab SSO 全链路阻断）
// - responseType != "code" → 400 UNSUPPORTED_RESPONSE_TYPE
// - oauthClient.clientId 不存在 → 400 INVALID_CLIENT
// - oauthClient.redirectUris 不包含 → 400 INVALID_REDIRECT_URI
// - code 绑定 Bearer 的 sub（userId）+ tenant_id claim——不信 body（四家共同语义：
//   msw「session 用户签出 code」/ springboot「Bearer sub + tenant_id claim」/
//   aspnetcore「session UserId/TenantId」；ADR-0019 synthetic identity 禁令）
// - 生成 saas-code-${ts}-${rand} 写入 oauth_code 表（2026-09-15 起落库，对齐
//   springboot/aspnetcore；client_id 存 code 形字符串——列是 varchar(64) FK →
//   oauth_client.client_id，不是行 UUID）
// - 返回 { code, state }
//
// 注意：OAuth 端点 dev 不验 clientSecret；生产由 springboot/aspnetcore 真后端验。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthClient, oauthCode, sysUser } from "@/db/schema";
import { generateAuthCode } from "@/lib/oauth-store";
import { claimsFromAuthHeader } from "@/lib/jwt";

const AuthorizeCodeRequest = z.object({
  // 5.59 A-1/B-1：删超契约 max 贴契约（AuthorizeCodeRequest.clientId 无约束；min1 保底）
  clientId: z.string().min(1),
  redirectUri: z.string().min(1).max(2048),
  responseType: z.string().min(1).max(64),
  // 5.59 B-1：删超契约 max 贴契约（scope?/state 无约束；min1 保底）
  scope: z.string().min(1),
  state: z.string().min(1),
});

function unauthorized(message: string): NextResponse {
  return NextResponse.json({ code: "UNAUTHORIZED", message }, { status: 401 });
}

/**
 * redirect 白名单匹配（aspnetcore OAuthController.cs 同款语义）：
 * DB 列 redirect_uris 是 csv 文本；匹配 = 精确相等，或白名单条目是请求的
 * 前缀且边界落在 '?'（RFC 6749 §3.1.2 允许 query 参数差异，lab 前端回跳带
 * ?from=<业务路径>）。子路径（'/call' vs '/callback'）不算匹配。
 */
function redirectUriAllowed(csv: string, requested: string): boolean {
  return csv
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean)
    .some(
      (u) =>
        requested === u ||
        (requested.startsWith(u) && requested.charAt(u.length) === "?"),
    );
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. 认证前置（2026-09-15 收敛）：无 Bearer / 验签失败 → 401，禁匿名签 code。
  //    claimsFromAuthHeader 对缺失 header 返回 null、坏 token throw JwtParseError。
  let claims;
  try {
    claims = await claimsFromAuthHeader(req.headers.get("authorization"));
  } catch {
    claims = null;
  }
  if (!claims?.sub) {
    return unauthorized("saas session or Bearer token required");
  }
  const userId = String(claims.sub);
  // tenant 必须来自认证身份（JWT tenant_id claim = 登录时确定的 currentTenantId），
  // 不信 body、不兜底字面量（ADR-0019）。
  const tenantId = typeof claims.tenant_id === "string" ? claims.tenant_id : null;
  if (!tenantId) {
    return unauthorized("JWT tenant_id claim required for authorize");
  }

  const parsed = AuthorizeCodeRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "INVALID_REQUEST",
        message: "OAuth 2.0 authorize: 缺必填字段或字段非法（clientId/redirectUri/responseType/scope/state）",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  if (body.responseType !== "code") {
    return NextResponse.json(
      { code: "UNSUPPORTED_RESPONSE_TYPE", message: "仅支持 responseType=code" },
      { status: 400 },
    );
  }

  const appRows = await db
    .select({
      id: oauthClient.id,
      redirectUris: oauthClient.redirectUris,
    })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, body.clientId))
    .limit(1);

  const app = appRows[0];
  if (!app) {
    return NextResponse.json(
      { code: "INVALID_CLIENT", message: "clientId 未注册或不可用" },
      { status: 400 },
    );
  }

  if (!redirectUriAllowed(app.redirectUris, body.redirectUri)) {
    return NextResponse.json(
      { code: "INVALID_REDIRECT_URI", message: "redirectUri 不在该 client 的白名单" },
      { status: 400 },
    );
  }

  // Bearer sub 必须是 saas 真用户（msw oracle「session user not found」→ 401 同款）
  const userRows = await db
    .select({ id: sysUser.id })
    .from(sysUser)
    .where(eq(sysUser.id, userId))
    .limit(1);
  if (!userRows[0]) {
    return unauthorized("session user not found");
  }

  const code = generateAuthCode();
  const ttl = Number(process.env.OAUTH_CODE_TTL) || 600; // 秒；aspnetcore 同款 10min
  await db.insert(oauthCode).values({
    code,
    // FK → oauth_client.client_id（code 形字符串）；行 UUID 会 23503
    clientId: body.clientId,
    userId,
    tenantId,
    redirectUri: body.redirectUri,
    scope: body.scope,
    expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
  });

  return NextResponse.json({ code, state: body.state });
}
