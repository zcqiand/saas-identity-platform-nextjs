// /api/v1/oauth/token — M04.F03.I02 + M04.F03.I03
//
// TypeSpec: TokenRequest { grantType: "authorization_code" | "refresh_token", code?, refreshToken?, clientId, clientSecret?, redirectUri? }
// 响应：TokenResponse { accessToken, refreshToken?, tokenType, expiresIn, scope }
//
// 语义（镜像 saas-identity-platform-msw/src/handlers-extra.ts:381-491）：
// - 缺 grantType/clientId → 400 INVALID_REQUEST
//   （tenantId 不是契约字段——2026-09-15 收敛，此前 zod 必填 + 比对是单侧漂移；
//   user/tenant 一律取 code 行绑定值，不信 body）
// - oauthClient.clientId 不存在 → 400 INVALID_CLIENT
// - grantType=authorization_code:
//   - 缺 code/redirectUri → 400 INVALID_REQUEST
//   - oauth_code 表无该行（含 clientId 不匹配）→ 400 INVALID_GRANT
//   - 过期 / redirectUri 与 authorize 时不一致 → 400 INVALID_GRANT
//   - 删除 code 行（一次性）→ 签 saas-jwt-${userId}-${nonce} + saas-rt-… → 写入 oauth-store.refreshTokens
// - grantType=refresh_token:
//   - 缺 refreshToken → 400 INVALID_REQUEST
//   - oauth-store.refreshTokens 中无 rt → 400 INVALID_GRANT
//   - 删除旧 rt（rotation）→ 签新 pair → 写入新 rt
// - 其他 grantType → 400 UNSUPPORTED_GRANT_TYPE
//
// 注意：dev 不严验 clientSecret；生产由 springboot/aspnetcore 真后端验。
// refresh token 仍在 oauth-store 内存（Phase 6 Redis）；code 自 2026-09-15 落 oauth_code 表
// （对齐 springboot/aspnetcore，dev server 重启不再丢 code → INVALID_GRANT）。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthClient, oauthCode } from "@/db/schema";
import { oauthStore, generateRefreshToken } from "@/lib/oauth-store";
import { signToken } from "@/lib/jwt";

const TokenRequest = z.object({
  grantType: z.enum(["authorization_code", "refresh_token"]),
  code: z.string().min(1).max(512).optional(),
  refreshToken: z.string().min(1).max(512).optional(),
  clientId: z.string().min(1).max(128),
  clientSecret: z.string().optional(),
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
    .select({ id: oauthClient.id })
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

  if (body.grantType === "authorization_code") {
    if (!body.code || !body.redirectUri) {
      return NextResponse.json(
        { code: "INVALID_REQUEST", message: "authorization_code: 缺 code 或 redirectUri" },
        { status: 400 },
      );
    }
    const rows = await db
      .select()
      .from(oauthCode)
      .where(and(eq(oauthCode.code, body.code), eq(oauthCode.clientId, body.clientId)))
      .limit(1);
    const row = rows[0];
    if (!row) {
      return NextResponse.json(
        { code: "INVALID_GRANT", message: "code 不存在或已被使用" },
        { status: 400 },
      );
    }
    if (new Date(row.expiresAt).getTime() <= Date.now()) {
      await db.delete(oauthCode).where(eq(oauthCode.id, row.id));
      return NextResponse.json(
        { code: "INVALID_GRANT", message: "code 已过期" },
        { status: 400 },
      );
    }
    if (row.redirectUri !== body.redirectUri) {
      // RFC 6749 §4.1.3：redirect_uri 必须与 authorize 时一致；不一致即撤销 code
      await db.delete(oauthCode).where(eq(oauthCode.id, row.id));
      return NextResponse.json(
        { code: "INVALID_GRANT", message: "redirectUri 与 authorize 时不一致" },
        { status: 400 },
      );
    }
    // 一次性消费：删 code 行（msw/springboot/aspnetcore 同款，重放 → 上方 not found）
    await db.delete(oauthCode).where(eq(oauthCode.id, row.id));
    const accessToken = await signToken({
      sub: row.userId,
      tenant_id: row.tenantId,
      scope: row.scope ?? undefined,
    });
    const refreshToken = generateRefreshToken(row.userId);
    oauthStore.putRefresh(refreshToken, {
      clientId: row.clientId,
      userId: row.userId,
      tenantId: row.tenantId,
      scope: row.scope ?? "",
    });

    // audit_events 在新 schema 不存在 → no-op（先前由 audit.ts lib 兜底）

    return NextResponse.json({
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn: 3600,
      scope: row.scope ?? "",
      // T11(2026-09-16) SSOT TokenResponse 必填三件回显（三方共库 UUID 逐字相等）。
      userId: row.userId,
      clientId: row.clientId,
      tenantId: row.tenantId,
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
    // T11(2026-09-16) SSOT TokenResponse 必填三件回显（三方共库 UUID 逐字相等）。
    userId: entry.userId,
    clientId: entry.clientId,
    tenantId: entry.tenantId,
  });
}
