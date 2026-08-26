// POST /api/v1/oauth/token
//
// OAuth 2.0 Token 端点（RFC 6749 §4.1.3 + §6）。grantType:
//   - authorization_code: 一次性 code 换 access_token (+ refresh_token)
//   - refresh_token: refresh token rotation (旧删新发)
//
// 镜像 saas-identity-platform-msw/src/handlers-extra.ts:415-489 的 dev mock 逻辑;
// accessToken 走 src/lib/jwt.ts 真签 HS256（与 prod saas-springboot/aspnetcore 镜像），
// refreshToken 仍是 oauthStore 内存 Map 的 opaque string。

import { NextResponse } from "next/server";
import "server-only";

import { oauthStore, generateRefreshToken } from "@/lib/oauth-store";
import { signToken } from "@/lib/jwt";
import apps from "@/seeds/apps.json";

interface TokenRequest {
  grantType?: "authorization_code" | "refresh_token";
  code?: string;
  refreshToken?: string;
  clientId?: string;
  clientSecret?: string;
  tenantId?: string;
  redirectUri?: string;
}

interface TokenResponse {
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresIn: number;
  scope: string;
}

interface ErrorResponse {
  code: string;
  message: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as TokenRequest;

  if (!body.grantType) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "缺 grantType" } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  // 1. clientId 必须注册 + 校验 clientSecret（生产 saas 必查;dev 可宽松）
  const app = (apps as Array<{
    clientId: string;
    clientSecret: string;
    id: string;
    scopes: string[];
  }>).find((a) => a.clientId === body.clientId);
  if (!app) {
    return NextResponse.json(
      { code: "INVALID_CLIENT", message: "clientId 未注册" } satisfies ErrorResponse,
      { status: 400 },
    );
  }
  // dev 宽松（生产 saas 必查;与 saas-msw 一致）—— 实际生产部署应配 clientSecret

  if (body.grantType === "authorization_code") {
    // === authorization_code grant ===
    if (!body.code || !body.tenantId || !body.redirectUri) {
      return NextResponse.json(
        { code: "INVALID_REQUEST", message: "authorization_code: 缺必填字段" } satisfies ErrorResponse,
        { status: 400 },
      );
    }

    const entry = oauthStore.consumeCode(body.code);
    if (!entry) {
      return NextResponse.json(
        { code: "INVALID_GRANT", message: "code 不存在或已被使用" } satisfies ErrorResponse,
        { status: 400 },
      );
    }
    if (entry.redirectUri !== body.redirectUri) {
      return NextResponse.json(
        { code: "INVALID_GRANT", message: "redirect_uri 与 authorize 时不一致" } satisfies ErrorResponse,
        { status: 400 },
      );
    }
    if (entry.tenantId !== body.tenantId) {
      return NextResponse.json(
        { code: "INVALID_GRANT", message: "tenantId 与 authorize 时不一致" } satisfies ErrorResponse,
        { status: 400 },
      );
    }

    // 真签 HS256 accessToken（RFC 7519 via jose）
    const accessToken = await signToken({
      sub: entry.userId,
      tenant_id: entry.tenantId,
      scope: entry.scope,
    });
    const refreshToken = generateRefreshToken(entry.userId);
    oauthStore.putRefresh(refreshToken, {
      appId: entry.appId,
      userId: entry.userId,
      tenantId: entry.tenantId,
      scope: entry.scope,
    });

    return NextResponse.json({
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: entry.scope,
    } satisfies TokenResponse);
  }

  if (body.grantType === "refresh_token") {
    // === refresh_token grant ===
    if (!body.refreshToken) {
      return NextResponse.json(
        { code: "INVALID_REQUEST", message: "refresh_token: 缺 refreshToken" } satisfies ErrorResponse,
        { status: 400 },
      );
    }
    const entry = oauthStore.rotateRefresh(body.refreshToken);
    if (!entry) {
      return NextResponse.json(
        { code: "INVALID_GRANT", message: "refreshToken 不存在或已被使用" } satisfies ErrorResponse,
        { status: 400 },
      );
    }
    // 旧 refreshToken 已 rotateRefresh 删了; 发新 access + 新 refresh
    const accessToken = await signToken({
      sub: entry.userId,
      tenant_id: entry.tenantId,
      scope: entry.scope,
    });
    const newRefresh = generateRefreshToken(entry.userId);
    oauthStore.putRefresh(newRefresh, entry);

    return NextResponse.json({
      accessToken,
      refreshToken: newRefresh,
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: entry.scope,
    } satisfies TokenResponse);
  }

  return NextResponse.json(
    {
      code: "UNSUPPORTED_GRANT_TYPE",
      message: "仅支持 grantType=authorization_code | refresh_token",
    } satisfies ErrorResponse,
    { status: 400 },
  );
}