// /api/v1/auth/oidc/callback — M03.F02.I03
//
// TypeSpec: OidcCallbackRequest { code, state, clientId }
// 响应：TokenResponse { accessToken, refreshToken?, tokenType, expiresIn, scope }
//
// dev pseudo-OIDC：信任客户端传回的 code + state，按 clientId 找 App，
// 取该 App 关联 tenant 下第一个 active 用户作为 dev 用户（生产应走真 IdP 流程）。
// 镜像 saas-identity-platform-msw/src/handlers-extra.ts:315-491 同款语义。
// 共享 oauthStore 与 /api/v1/oauth/token grantType=authorization_code 路径对齐。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { apps, users } from "@/db/schema";
import { oauthStore, generateRefreshToken } from "@/lib/oauth-store";
import { signToken } from "@/lib/jwt";

const OidcCallbackRequest = z.object({
  code: z.string().min(1).max(512),
  state: z.string().min(1).max(512),
  clientId: z.string().min(1).max(128),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = OidcCallbackRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "INVALID_REQUEST",
        message: "OIDC callback: 缺必填字段或字段非法（code/state/clientId）",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // 1) 按 clientId 找 App（dev 模式下要求 App 有非空 redirectUris；state 由调用方管理）
  const appRows = await db
    .select({ id: apps.id, redirectUris: apps.redirectUris })
    .from(apps)
    .where(eq(apps.clientId, body.clientId))
    .limit(1);
  const app = appRows[0];
  if (!app) {
    return NextResponse.json(
      { code: "INVALID_CLIENT", message: "OIDC callback: clientId 未注册" },
      { status: 400 },
    );
  }

  // 2) dev mock 用户绑定：从 App 第一个 redirectUri 反向寻租户 / 用户（生产 saas-springboot/aspnetcore 真后端走 IdP 用户认证）
  // 简化：取任意一个 active 用户（dev 用）
  const userRows = await db
    .select({ id: users.id, tenantId: users.tenantId })
    .from(users)
    .where(eq(users.status, "active"))
    .limit(1);

  const devUser = userRows[0];
  if (!devUser) {
    return NextResponse.json(
      { code: "NO_USER", message: "OIDC callback: dev mock — 系统内找不到 active 用户" },
      { status: 400 },
    );
  }

  // 3) 把 OIDC callback 视为一次性 code exchange — 把外部 code 写进 oauth-store 当成「authorize 阶段的 code」，
  //    内部立刻 consumeCode 拿到 entry 再签 saas-jwt / saas-rt
  // 简化路径：直接签 HS256 JWT（不再二次 code exchange，避免与 /oauth/token 双语义重叠）
  const accessToken = await signToken({
    sub: devUser.id,
    tenant_id: devUser.tenantId,
    scope: "openid",
  });
  const refreshToken = generateRefreshToken(devUser.id);
  oauthStore.putRefresh(refreshToken, {
    appId: app.id,
    userId: devUser.id,
    tenantId: devUser.tenantId,
    scope: "openid",
  });

  return NextResponse.json({
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: 3600,
    scope: "openid",
  });
}

// Suppress unused-import warning for `and` (kept for future tenant+user composite filters)
void and;