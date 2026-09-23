// CORS middleware for /api/v1/* — consume SAAS_CORS_ALLOWED_ORIGINS
//
// Why this exists:
//   saas-nextjs 的 /api/v1/* 是「跨仓 lab-nextjs 浏览器」的消费方（同仓只有 SSR / Route Handler）。
//   浏览器跨域请求会撞 CORS；这里把允许的 origin 白名单读出来挂响应头，
//   lab-nextjs 浏览器拿到 Allow-Origin 后才能读响应。
//
// 配置来源：
//   .env.example:47  SAAS_CORS_ALLOWED_ORIGINS=http://localhost:5101,...  （逗号分隔 origin 列表）
//   镜像 springboot SAAS_CORS_ALLOWED_ORIGINS / aspnetcore Saas.Cors.AllowedOrigins，
//   SSOT 命名不另起。
//
// 行为：
//   - 命中 allowlist 的 origin：响应注入 Access-Control-Allow-Origin + Vary: Origin +
//     Access-Control-Allow-Credentials + Allow-Methods / Allow-Headers；OPTIONS 直接 204。
//   - 没命中 allowlist：不挂 CORS 头，浏览器层会被拦（即使到达路由处理器也读不到响应）。
//   - 空 env / 没配：默认 fail-safe —— 任何 origin 都不放行（开发期要补 .env）。
//   - 不挂 Access-Control-Allow-Origin: * —— 因为要支持 credential + Authorization header，
//     spec 要求 origin 必须回显具体值。
//
// Next.js 15 middleware 跑在 Edge runtime；这里只读 env + 拼 header，不 import @/db 等
// 会在模块顶层 throw 的模块（src/db/index.ts:13-18 在缺 DATABASE_URL 时炸）。

import { NextRequest, NextResponse } from "next/server";

const ALLOWED_HEADERS = "Authorization, Content-Type";
const ALLOWED_METHODS = "GET, POST, PUT, PATCH, DELETE, OPTIONS";
const MAX_AGE_SECONDS = "86400";

function parseAllowedOrigins(): Set<string> {
  const raw = process.env.SAAS_CORS_ALLOWED_ORIGINS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
}

export function middleware(req: NextRequest) {
  const origin = req.headers.get("origin");
  const allowed = parseAllowedOrigins();
  const originAllowed = !!origin && allowed.has(origin);

  // 预检 OPTIONS：命中就 204 + 全套 CORS 头；不命中也返 204 但不挂 Allow-Origin
  // （让浏览器自己拦，请求不会到路由处理器；Next.js 不会自动 OPTIONS App Router 路由）
  if (req.method === "OPTIONS") {
    const res = new NextResponse(null, { status: 204 });
    if (originAllowed && origin) {
      res.headers.set("Access-Control-Allow-Origin", origin);
      res.headers.set("Vary", "Origin");
      res.headers.set("Access-Control-Allow-Credentials", "true");
      res.headers.set("Access-Control-Allow-Methods", ALLOWED_METHODS);
      res.headers.set("Access-Control-Allow-Headers", ALLOWED_HEADERS);
      res.headers.set("Access-Control-Max-Age", MAX_AGE_SECONDS);
    }
    return res;
  }

  // 实际请求：放行到路由处理器，响应再加 CORS 头（next() 之后再 set 不会冲突）
  const res = NextResponse.next();
  if (originAllowed && origin) {
    res.headers.set("Access-Control-Allow-Origin", origin);
    res.headers.set("Vary", "Origin");
    res.headers.set("Access-Control-Allow-Credentials", "true");
    res.headers.set("Access-Control-Expose-Headers", ALLOWED_HEADERS);
  }
  return res;
}

export const config = {
  // 仅拦截 /api/v1/*；其他路径（页面、/api/auth 等其他子路径）不走 CORS middleware，
  // 由各自路由决定。/api/v1/oauth/* 也包含在内 —— 浏览器不会直接调（confidential client
  // 服务端调，无 CORS 需求），多挂一组 header 无副作用。
  matcher: ["/api/v1/:path*"],
};
