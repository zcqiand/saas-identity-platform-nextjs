// @vitest-environment node
// middleware CORS contract — v0.7.40
//
// 锁住 SAAS_CORS_ALLOWED_ORIGINS 的行为契约：浏览器跨域请求 /api/v1/* 时
// middleware 必须正确放行（Allow-Origin 回显具体 origin + Vary: Origin +
// Allow-Credentials + Allow-Methods / Allow-Headers / Max-Age），未授权 origin
// 一律不放行（返回 204 但 Allow-Origin 缺失，浏览器层会拦）。
//
// 直接调 middleware 函数，不启 server：Next.js 15 middleware 是纯函数，
// 入参 NextRequest，出参 NextResponse，单测足够锁契约。

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../../middleware";

const ALLOWLIST = "https://lab-nextjs.xiangru.uk,http://localhost:5101";

function makeReq(opts: {
  method?: string;
  origin?: string;
  path?: string;
  acrh?: string; // Access-Control-Request-Headers
}): NextRequest {
  const headers: Record<string, string> = {};
  if (opts.origin) headers["origin"] = opts.origin;
  if (opts.acrh) headers["access-control-request-headers"] = opts.acrh;
  return new NextRequest(
    new Request(`https://saas-nextjs.xiangru.uk${opts.path ?? "/api/v1/me/menus"}`, {
      method: opts.method ?? "GET",
      headers,
    }),
  );
}

describe("middleware CORS /api/v1/* (v0.7.40)", () => {
  let origEnv: string | undefined;
  beforeEach(() => {
    origEnv = process.env.SAAS_CORS_ALLOWED_ORIGINS;
  });
  afterEach(() => {
    if (origEnv === undefined) delete process.env.SAAS_CORS_ALLOWED_ORIGINS;
    else process.env.SAAS_CORS_ALLOWED_ORIGINS = origEnv;
  });

  describe("OPTIONS preflight", () => {
    it("allowlisted origin → 204 + full CORS headers", async () => {
      process.env.SAAS_CORS_ALLOWED_ORIGINS = ALLOWLIST;
      const res = await middleware(
        makeReq({
          method: "OPTIONS",
          origin: "https://lab-nextjs.xiangru.uk",
          acrh: "authorization",
        }),
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://lab-nextjs.xiangru.uk",
      );
      expect(res.headers.get("Vary")).toBe("Origin");
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
      expect(res.headers.get("Access-Control-Allow-Methods")).toContain("GET");
      expect(res.headers.get("Access-Control-Allow-Headers")).toContain(
        "Authorization",
      );
      expect(res.headers.get("Access-Control-Max-Age")).toBe("86400");
    });

    it("non-allowlisted origin → 204 但无 Allow-Origin（浏览器层拦）", async () => {
      process.env.SAAS_CORS_ALLOWED_ORIGINS = ALLOWLIST;
      const res = await middleware(
        makeReq({ method: "OPTIONS", origin: "https://evil.example" }),
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBeNull();
    });

    it("no Origin 头（服务端到服务端调用）→ 204 但无 CORS 头", async () => {
      process.env.SAAS_CORS_ALLOWED_ORIGINS = ALLOWLIST;
      const res = await middleware(makeReq({ method: "OPTIONS" }));
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("空 env → fail-safe，任何 origin 都不放行", async () => {
      delete process.env.SAAS_CORS_ALLOWED_ORIGINS;
      const res = await middleware(
        makeReq({
          method: "OPTIONS",
          origin: "https://lab-nextjs.xiangru.uk",
        }),
      );
      expect(res.status).toBe(204);
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });

  describe("实际请求（非 OPTIONS）", () => {
    it("allowlisted origin GET → 透传到路由 + 响应挂 CORS 头", async () => {
      process.env.SAAS_CORS_ALLOWED_ORIGINS = ALLOWLIST;
      const res = await middleware(
        makeReq({
          method: "GET",
          origin: "https://lab-nextjs.xiangru.uk",
        }),
      );
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://lab-nextjs.xiangru.uk",
      );
      expect(res.headers.get("Vary")).toBe("Origin");
      expect(res.headers.get("Access-Control-Allow-Credentials")).toBe("true");
      expect(res.headers.get("Access-Control-Expose-Headers")).toContain(
        "Authorization",
      );
    });

    it("非 allowlisted origin GET → 透传但不挂 CORS 头（浏览器层拦）", async () => {
      process.env.SAAS_CORS_ALLOWED_ORIGINS = ALLOWLIST;
      const res = await middleware(
        makeReq({ method: "GET", origin: "https://evil.example" }),
      );
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });

    it("server-to-server 调用（无 Origin）→ 透传，无 CORS 头", async () => {
      process.env.SAAS_CORS_ALLOWED_ORIGINS = ALLOWLIST;
      const res = await middleware(makeReq({ method: "GET" }));
      expect(res.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });

  describe("matcher 覆盖", () => {
    // matcher 本身在 middleware.ts 的 config.matcher 里定义；这里只确认
    // 我们的测试路径都命中 /api/v1/*（middleware 实际只在这条路径上跑）。
    it("/api/v1/* 路径命中（间接通过函数调用验证行为）", async () => {
      process.env.SAAS_CORS_ALLOWED_ORIGINS = ALLOWLIST;
      const res = await middleware(
        makeReq({
          method: "GET",
          origin: "https://lab-nextjs.xiangru.uk",
          path: "/api/v1/apps/lab-management",
        }),
      );
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://lab-nextjs.xiangru.uk",
      );
    });
  });
});
