// POST /api/v1/oauth/authorize
//
// OAuth 2.0 Authorization Code 端点（RFC 6749 §4.1.1）。saas-identity-platform-nextjs
// 作为 IdP 接收 confidential client（lab-nextjs）的 code 申请，校验 clientId/redirectUri/scope/tenantId，
// 生成一次性 authorization code 存 oauthStore, 返回 { code, state }。
//
// 镜像 saas-identity-platform-msw/src/handlers-extra.ts:348-412 的 dev mock 逻辑;
// 真实 saas-msw 现在 Phase 1A 后也签真 HS256, 但这里是 IdP 端点而非 mock。
//
// 注意：路径是 /api/v1/oauth/authorize（与 shared OpenAPI 一致）。lab-nextjs 在
// src/app/api/auth/sso/authorize/route.ts 调用此端点。

import { NextResponse } from "next/server";
import "server-only";

import { oauthStore, generateAuthCode } from "@/lib/oauth-store";
import apps from "@/seeds/apps.json";
import users from "@/seeds/users.json";

interface AuthorizeCodeRequest {
  clientId?: string;
  redirectUri?: string;
  responseType?: string;
  scope?: string;
  state?: string;
  tenantId?: string;
}

interface ErrorResponse {
  code: string;
  message: string;
}

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as AuthorizeCodeRequest;

  // 1. 必填字段校验
  const required: (keyof AuthorizeCodeRequest)[] = [
    "clientId",
    "redirectUri",
    "responseType",
    "scope",
    "state",
    "tenantId",
  ];
  for (const k of required) {
    if (!body[k] || String(body[k]).length === 0) {
      return NextResponse.json(
        {
          code: "INVALID_REQUEST",
          message: `OAuth 2.0 authorize: 缺必填字段 (${k})`,
        } satisfies ErrorResponse,
        { status: 400 },
      );
    }
  }

  // 2. responseType 必须 code
  if (body.responseType !== "code") {
    return NextResponse.json(
      {
        code: "UNSUPPORTED_RESPONSE_TYPE",
        message: "仅支持 responseType=code",
      } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  // 3. clientId 必须注册
  const app = (apps as Array<{ clientId: string; id: string; redirectUris: string[]; scopes: string[] }>).find(
    (a) => a.clientId === body.clientId,
  );
  if (!app) {
    return NextResponse.json(
      { code: "INVALID_CLIENT", message: "clientId 未注册" } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  // 4. redirectUri 必须在 client 的白名单内
  if (!app.redirectUris.includes(body.redirectUri ?? "")) {
    return NextResponse.json(
      { code: "INVALID_REDIRECT_URI", message: "redirectUri 不在该 client 的白名单" } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  // 5. scope 必须在 client.scopes 内（至少一项匹配）
  const requested = (body.scope ?? "").split(" ").filter(Boolean);
  if (!requested.some((s) => app.scopes.includes(s))) {
    return NextResponse.json(
      { code: "INVALID_SCOPE", message: "scope 不匹配 client.scopes" } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  // 6. tenantId 下必须有用户 (dev mock 隐式校验;生产 saas 在 App 上加 tenants 字段显式建模)
  const tenantUser = (users as Array<{ id: string; tenantId: string }>).find(
    (u) => u.tenantId === body.tenantId,
  );
  if (!tenantUser) {
    return NextResponse.json(
      { code: "NO_USER", message: "该 tenant 下找不到用户" } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  // 7. 生成一次性 code + 存 oauthStore
  const code = generateAuthCode();
  oauthStore.putCode(code, {
    appId: app.id,
    userId: tenantUser.id,
    tenantId: body.tenantId!,
    scope: body.scope!,
    redirectUri: body.redirectUri!,
  });

  return NextResponse.json({ code, state: body.state });
}