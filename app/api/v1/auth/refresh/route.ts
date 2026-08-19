// /api/v1/auth/refresh — M03.F02.I04
//
// TypeSpec: TokenRequest { grantType: "refresh_token", refreshToken, clientId, clientSecret?, tenantId, redirectUri? }
// 响应：TokenResponse
//
// v0.5.0 auth 批次：切到 oauth-store.rotateRefresh（与 /api/v1/oauth/token grantType=refresh_token 同款语义）；
// 旧 regex parse 路径已废止（msw handler-extra.ts:456-483 mirror）。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { oauthStore, generateAccessToken, generateRefreshToken } from "@/lib/oauth-store";

const RefreshRequest = z.object({
  grantType: z.literal("refresh_token"),
  refreshToken: z.string().min(1).max(512),
  clientId: z.string().min(1).max(128),
  clientSecret: z.string().optional(),
  tenantId: z.string().uuid(),
  redirectUri: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = RefreshRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Invalid refresh request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { refreshToken, tenantId } = parsed.data;

  // 与 /oauth/token grantType=refresh_token 行为统一：rotate 删除旧、签新对
  const entry = oauthStore.rotateRefresh(refreshToken);
  if (!entry) {
    return NextResponse.json(
      { code: "INVALID_GRANT", message: "refreshToken 不存在或已被使用" },
      { status: 400 },
    );
  }
  if (entry.tenantId !== tenantId) {
    return NextResponse.json(
      { code: "INVALID_GRANT", message: "tenantId 与 refresh 时不一致" },
      { status: 400 },
    );
  }

  const accessToken = generateAccessToken(entry.userId);
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