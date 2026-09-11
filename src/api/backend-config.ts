// 后端配置：env-driven 单 URL（ADR-0014）。
//
// 旧 4-backend 运行时切换（msw / aspnetcore / springboot / nextjs-self）+ localStorage
// 持久化 + Module 单例 + Context 已废弃。改用：
//
//   NEXT_PUBLIC_API_BASE_URL   后端 base URL（默认 "http://localhost:5100" msw-http）
//   NEXT_PUBLIC_API_MODE       显示标签（默认 "msw-http"），仅 UI 显示
//
// ADR-0012 v0.3.0：Service Worker 模式完全删除。dev 路径只走 msw-http
//（独立 HTTP server，由 @saas/identity-platform-msw/src/server.ts 起在 :5100）；
// *_ENABLE_MSW env 与 isMswEnabled() 函数一并删除。
//
// 所有调用方从 `getBaseUrl()` / `getBackend()` 切到 `getApiBaseUrl()` / `getApiMode()`。

import { env } from "./env";

// === 2026-09-11 用户裁定：恢复 4 后端运行时切换（用户指令覆盖 ADR-0014 dev 单 URL）===
// prod 仍走部署期 env 同源反代；切换器是 dev/local 诊断工具（localStorage 持久化，
// 每次请求经 http-client 拦截器动态读取，切完下一个请求即生效）。端口表 = multi-repo-family §6。
export const BACKENDS = [
  { key: "msw", baseUrl: "http://localhost:5100" },
  { key: "nextjs", baseUrl: "http://localhost:5101" },
  { key: "aspnetcore", baseUrl: "http://localhost:5104" },
  { key: "springboot", baseUrl: "http://localhost:5105" },
] as const;

const BACKEND_LS_KEY = "saas.api.backend";

/** 当前选中的后端 key（"" = 未选择，走 env 默认）。SSR 环境返回 ""。 */
export function getSelectedBackend(): string {
  try {
    return globalThis.localStorage?.getItem(BACKEND_LS_KEY) ?? "";
  } catch {
    return "";
  }
}

export function setSelectedBackend(key: string): void {
  try {
    if (key) localStorage.setItem(BACKEND_LS_KEY, key);
    else localStorage.removeItem(BACKEND_LS_KEY);
  } catch {
    /* localStorage 不可用（SSR/隐私模式）：忽略 */
  }
}

export function getApiBaseUrl(): string {
  // 运行时切换优先；未选择时走 env。
  const selected = getSelectedBackend();
  if (selected) {
    const hit = BACKENDS.find((b) => b.key === selected);
    if (hit) return hit.baseUrl;
  }
  // 用 ?? 而非 ||：prod 部署 saas.env NEXT_PUBLIC_API_BASE_URL="" 时
  // 应走同源相对路径（nginx 反代到 127.0.0.1:8022 容器）,"" 不是 nullish
  // 必须保留。dev 没设 env 时 fallback 到 msw-http :5100。
  return env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5100";
}

export function getApiMode(): string {
  return env.NEXT_PUBLIC_API_MODE ?? "msw-http";
}