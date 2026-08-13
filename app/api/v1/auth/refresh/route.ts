// /api/v1/auth/refresh — M03.F02.I04
//
// TypeSpec: tsp/routes/auth.tsp refreshToken(@body body: TokenRequest): TokenResponse
// body: { grantType: "refresh_token", refreshToken, clientId, clientSecret?, tenantId, redirectUri? }
//
// 语义：
// - 校验 refresh_token（Phase 5 占位：只校验非空；正式需要查 DB 或签发 service）
// - 校验 clientId + tenantId 一致
// - 签发新 access_token（payload 含 sub + tenant_id）
// - 返回新 tokenResponse

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";

const TokenRequest = z.object({
  grantType: z.literal("refresh_token"),
  refreshToken: z.string().min(1),
  clientId: z.string().uuid(),
  clientSecret: z.string().optional(),
  tenantId: z.string().uuid(),
  redirectUri: z.string().optional(),
});

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function issueAccessToken(userId: string, tenantId: string): string {
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      tenant_id: tenantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${header}.${payload}.dev-placeholder`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = TokenRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Invalid refresh request" },
      { status: 400 },
    );
  }
  const { refreshToken, clientId, tenantId } = parsed.data;

  // 验证 clientId 存在（apps 表里有这个 OAuth client）
  const app = await db
    .select({ id: apps.id })
    .from(apps)
    .where(and(eq(apps.clientId, clientId), eq(apps.id, tenantId)))
    .limit(1);

  if (!app[0]) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Invalid client" },
      { status: 401 },
    );
  }

  // Phase 5 占位：refresh_token 不查 DB（服务无状态 JWT）；Phase 6 接 refresh_token 表或 Redis。
  // 从 refreshToken 中提取 userId（约定格式：refresh-${userId}-${ts}）
  const userIdMatch = refreshToken.match(/^refresh-([0-9a-f-]{36})-\d+$/);
  if (!userIdMatch) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Invalid refresh token" },
      { status: 401 },
    );
  }
  const userId = userIdMatch[1]!;

  return NextResponse.json({
    accessToken: issueAccessToken(userId, tenantId),
    refreshToken: `refresh-${userId}-${Date.now()}`,
    tokenType: "Bearer",
    expiresIn: 3600,
    scope: "",
  });
}