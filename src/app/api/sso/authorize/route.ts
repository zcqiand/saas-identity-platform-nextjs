/**
 * M03.F02.I01 - GET /api/sso/authorize
 *
 * OAuth 2.0 授权码流程入口。client（lab 仓）带 client_id/redirect_uri/state 跳到此端点，
 * saas 端校验通过后 302 跳回 redirect_uri，附上一次性 code。
 *
 * mock 模式（本仓现状）：
 *   - 不强校 client_id（任何非空字符串都通过；saas 仓生产版应查 apps 表校验）
 *   - code 形如 `mock-auth-code-<timestamp>`，可被 /api/auth/oauth/callback 识别
 *   - state 原样回传（防 CSRF 由 client 比对）
 *
 * 路径选择：本仓的 oauth-url.ts 已统一使用 /api/sso/* 路径（与 saas-React 仓 msw 路径 /sso/*
 *   不一致），故本路由也走 /api/sso/authorize，与 oauth-url.ts 拼出的 URL 对齐。
 */
import { NextResponse } from "next/server";
import { labTenant } from "@saas/identity-platform-shared/seeds";

export async function GET(req: Request) {
  // shared 派生校验：lab 租户必须存在（启动期 sanity check）
  const tenant = labTenant();
  if (!tenant) {
    return NextResponse.json({ message: "lab 租户未配置" }, { status: 500 });
  }

  const url = new URL(req.url);
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  const state = url.searchParams.get("state") ?? "";

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { message: "缺少 client_id 或 redirect_uri" },
      { status: 400 },
    );
  }

  // 校验 redirect_uri 是 http(s) URL（防 open redirect 攻击：mock 阶段最小校验，
  // 生产应加白名单 / 同源 / 注册域名校验）。
  let parsedRedirect: URL;
  try {
    parsedRedirect = new URL(redirectUri);
    if (parsedRedirect.protocol !== "http:" && parsedRedirect.protocol !== "https:") {
      throw new Error("non-http(s) scheme");
    }
  } catch {
    return NextResponse.json({ message: "redirect_uri 不合法" }, { status: 400 });
  }

  const code = `mock-auth-code-${Date.now()}`;
  const callback = new URL(parsedRedirect.toString());
  callback.searchParams.set("code", code);
  if (state) callback.searchParams.set("state", state);

  return NextResponse.redirect(callback.toString(), { status: 302 });
}
