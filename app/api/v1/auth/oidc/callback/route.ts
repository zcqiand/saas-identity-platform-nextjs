// /api/v1/auth/oidc/callback — M01.F04.I04
//
// TypeSpec: OidcCallbackRequest { code, state, clientId }
// 响应：TokenResponse { accessToken, refreshToken?, tokenType, expiresIn, scope }
//
// dev pseudo-OIDC：信任客户端传回的 code + state，按 clientId 找 oauthClient，
// 取首个 active sysUser 作为 dev 用户。镜像 saas-identity-platform-msw handlers-extra.ts:315-491。
// 共享 oauthStore 与 /api/v1/oauth/token grantType=authorization_code 路径对齐。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { oauthClient, sysUser, tenantMember } from "@/db/schema";
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

  // 1) 按 clientId 找 oauthClient
  const appRows = await db
    .select({ id: oauthClient.id, redirectUris: oauthClient.redirectUris })
    .from(oauthClient)
    .where(eq(oauthClient.clientId, body.clientId))
    .limit(1);
  const app = appRows[0];
  if (!app) {
    return NextResponse.json(
      { code: "INVALID_CLIENT", message: "OIDC callback: clientId 未注册" },
      { status: 400 },
    );
  }

  // 2) dev mock 用户绑定：取任意一个 active sysUser
  const userRows = await db
    .select({ id: sysUser.id })
    .from(sysUser)
    .where(eq(sysUser.status, 1))
    .limit(1);

  const devUser = userRows[0];
  if (!devUser) {
    return NextResponse.json(
      { code: "NO_USER", message: "OIDC callback: dev mock — 系统内找不到 active 用户" },
      { status: 400 },
    );
  }

  // 3) 取 devUser 的首个 active tenantMember.tenantId
  const memberRows = await db
    .select({ tenantId: tenantMember.tenantId })
    .from(tenantMember)
    .where(and(eq(tenantMember.userId, devUser.id), eq(tenantMember.status, 1)))
    .limit(1);
  const devTenantId = memberRows[0]?.tenantId;
  if (!devTenantId) {
    return NextResponse.json(
      { code: "NO_TENANT", message: "OIDC callback: dev mock — 用户无 active tenant" },
      { status: 400 },
    );
  }

  const accessToken = await signToken({
    sub: devUser.id,
    tenant_id: devTenantId,
    scope: "openid",
  });
  const refreshToken = generateRefreshToken(devUser.id);
  oauthStore.putRefresh(refreshToken, {
    clientId: app.id,
    userId: devUser.id,
    tenantId: devTenantId,
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
