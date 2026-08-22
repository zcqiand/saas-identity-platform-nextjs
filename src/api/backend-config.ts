// 后端配置：env-driven 单 URL（ADR-0014）。
//
// 旧 4-backend 运行时切换（msw / aspnetcore / springboot / nextjs-self）+ localStorage
// 持久化 + Module 单例 + Context 已废弃。改用：
//
//   NEXT_PUBLIC_API_BASE_URL   后端 base URL（默认 "http://localhost:5174" msw-http）
//   NEXT_PUBLIC_API_MODE       显示标签（默认 "msw-http"），仅 UI 显示
//
// ADR-0012 v0.3.0：Service Worker 模式完全删除。dev 路径只走 msw-http
//（独立 HTTP server，由 @saas/identity-platform-msw/src/server.ts 起在 :5174）；
// *_ENABLE_MSW env 与 isMswEnabled() 函数一并删除。
//
// 所有调用方从 `getBaseUrl()` / `getBackend()` 切到 `getApiBaseUrl()` / `getApiMode()`。

import { env } from "./env";

export function getApiBaseUrl(): string {
  // 用 ?? 而非 ||：prod 部署 saas.env NEXT_PUBLIC_API_BASE_URL="" 时
  // 应走同源相对路径（nginx 反代到 127.0.0.1:8022 容器）,"" 不是 nullish
  // 必须保留。dev 没设 env 时 fallback 到 msw-http :5174。
  return env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5174";
}

export function getApiMode(): string {
  return env.NEXT_PUBLIC_API_MODE ?? "msw-http";
}