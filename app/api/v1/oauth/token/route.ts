// /api/v1/oauth/token — M04.F03.I08 + M04.F03.I09
//
// TypeSpec: TokenRequest { grantType: "authorization_code" | "refresh_token", code?, refreshToken?, clientId, clientSecret?, tenantId, redirectUri? }
// 响应：TokenResponse { accessToken, refreshToken?, tokenType, expiresIn, scope }
//
// 语义（镜像 saas-identity-platform-msw/src/handlers-extra.ts:381-491）：
// - 缺 grantType/clientId/tenantId → 400 INVALID_REQUEST
// - apps.clientId 不存在 → 400 INVALID_CLIENT
// - grantType=authorization_code:
//   - 缺 code/redirectUri → 400 INVALID_REQUEST
//   - oauth-store.codes 中无 code → 400 INVALID_GRANT
//   - redirectUri/tenantId 不匹配 → 400 INVALID_GRANT
//   - 删除 code（一次性）→ 签 saas-jwt-${userId}-${nonce} + saas-rt-… → 写入 oauth-store.refreshTokens
// - grantType=refresh_token:
//   - 缺 refreshToken → 400 INVALID_REQUEST
//   - oauth-store.refreshTokens 中无 rt → 400 INVALID_GRANT
//   - 删除旧 rt（rotation）→ 签新 pair → 写入新 rt
// - 其他 grantType → 400 UNSUPPORTED_GRANT_TYPE
//
// 注意：dev 不严验 clientSecret；生产由 springboot/aspnetcore 真后端验。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps, auditEvents } from "@/db/schema";
import { oauthStore, generateRefreshToken } from "@/lib/oauth-store";
import { signToken } from "@/lib/jwt";

const TokenRequest = z.object({
  grantType: z.enum(["authorization_code", "refresh_token"]),
  code: z.string().min(1).max(512).optional(),
  refreshToken: z.string().min(1).max(512).optional(),
  clientId: z.string().min(1).max(128),
  clientSecret: z.string().optional(),
  tenantId: z.string().uuid(),
  redirectUri: z.string().min(1).max(2048).optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = TokenRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "INVALID_REQUEST",
        message: "OAuth 2.0 token: 缺必填字段或字段非法",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  const appRows = await db
    .select({ id: apps.id })
    .from(apps)
    .where(eq(apps.clientId, body.clientId))
    .limit(1);
  const app = appRows[0];
  if (!app) {
    return NextResponse.json(
      { code: "INVALID_CLIENT", message: "clientId 未注册或不可用" },
      { status: 400 },
    );
  }

  if (body.grantType === "authorization_code") {
    if (!body.code || !body.redirectUri) {
      return NextResponse.json(
        { code: "INVALID_REQUEST", message: "authorization_code: 缺 code 或 redirectUri" },
        { status: 400 },
      );
    }
    const entry = oauthStore.consumeCode(body.code);
    if (!entry) {
      return NextResponse.json(
        { code: "INVALID_GRANT", message: "code 不存在或已被使用" },
        { status: 400 },
      );
    }
    if (entry.redirectUri !== body.redirectUri) {
      return NextResponse.json(
        { code: "INVALID_GRANT", message: "redirectUri 与 authorize 时不一致" },
        { status: 400 },
      );
    }
    if (entry.tenantId !== body.tenantId) {
      return NextResponse.json(
        { code: "INVALID_GRANT", message: "tenantId 与 authorize 时不一致" },
        { status: 400 },
      );
    }
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

    // audit_events: oauth_token_issued（dev 写库；生产可异步队列）
    try {
      await db.insert(auditEvents).values({
        tenantId: entry.tenantId,
        actorUserId: entry.userId,
        action: "oauth_token_issued",
        metadata: { clientId: body.clientId, grantType: body.grantType },
      });
    } catch {
      // 写 audit 失败不阻塞 token 签发
    }

    return NextResponse.json({
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: entry.scope,
    });
  }

  // body.grantType === "refresh_token"
  if (!body.refreshToken) {
    return NextResponse.json(
      { code: "INVALID_REQUEST", message: "refresh_token: 缺 refreshToken" },
      { status: 400 },
    );
  }
  const entry = oauthStore.rotateRefresh(body.refreshToken);
  if (!entry) {
    return NextResponse.json(
      { code: "INVALID_GRANT", message: "refreshToken 不存在或已被使用" },
      { status: 400 },
    );
  }
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
  });
}