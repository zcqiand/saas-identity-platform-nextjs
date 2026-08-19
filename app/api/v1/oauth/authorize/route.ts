// /api/v1/oauth/authorize — M04.F03.I07
//
// TypeSpec: AuthorizeCodeRequest { clientId, redirectUri, responseType: "code", scope, state, tenantId }
// 响应：{ code, state }（自定义 inline schema；openapi.yaml:778-786）
//
// 语义（镜像 saas-identity-platform-msw/src/handlers-extra.ts:315-379）：
// - 缺字段 → 400 INVALID_REQUEST
// - responseType != "code" → 400 UNSUPPORTED_RESPONSE_TYPE
// - apps.clientId 不存在 → 400 INVALID_CLIENT
// - apps.redirectUris 不包含 → 400 INVALID_REDIRECT_URI
// - tenant 下无用户 → 400 NO_USER（dev mock 限定）
// - 生成 saas-code-${ts}-${rand} 写入 oauth-store.codes
// - 返回 { code, state }
//
// 注意：OAuth 端点 dev 不验 clientSecret；生产由 springboot/aspnetcore 真后端验。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps, users } from "@/db/schema";
import { oauthStore, generateAuthCode } from "@/lib/oauth-store";

const AuthorizeCodeRequest = z.object({
  clientId: z.string().min(1).max(128),
  redirectUri: z.string().min(1).max(2048),
  responseType: z.string().min(1).max(64),
  scope: z.string().min(1).max(512),
  state: z.string().min(1).max(512),
  tenantId: z.string().uuid(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = AuthorizeCodeRequest.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "INVALID_REQUEST",
        message: "OAuth 2.0 authorize: 缺必填字段或字段非法（clientId/redirectUri/responseType/scope/state/tenantId）",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }
  const body = parsed.data;

  // 显式校验 responseType === "code"（镜像 handlers-extra.ts:340-345）
  if (body.responseType !== "code") {
    return NextResponse.json(
      { code: "UNSUPPORTED_RESPONSE_TYPE", message: "仅支持 responseType=code" },
      { status: 400 },
    );
  }

  const appRows = await db
    .select({
      id: apps.id,
      redirectUris: apps.redirectUris,
    })
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

  if (!app.redirectUris.includes(body.redirectUri)) {
    return NextResponse.json(
      { code: "INVALID_REDIRECT_URI", message: "redirectUri 不在该 client 的白名单" },
      { status: 400 },
    );
  }

  // dev mock：用「该 tenant 下是否有用户」隐式校验 tenant 有效性（镜像 handlers-extra.ts:362）
  const devUserRows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.tenantId, body.tenantId))
    .limit(1);

  const devUser = devUserRows[0];
  if (!devUser) {
    return NextResponse.json(
      { code: "NO_USER", message: "dev mock: 该 tenant 下找不到用户" },
      { status: 400 },
    );
  }

  const code = generateAuthCode();
  oauthStore.putCode(code, {
    appId: app.id,
    userId: devUser.id,
    tenantId: body.tenantId,
    scope: body.scope,
    redirectUri: body.redirectUri,
  });

  return NextResponse.json({ code, state: body.state });
}