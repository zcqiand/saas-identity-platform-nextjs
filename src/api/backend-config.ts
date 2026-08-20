// 后端配置：env-driven 单 URL（ADR-0014）。
//
// 旧 4-backend 运行时切换（msw / aspnetcore / springboot / nextjs-self）+ localStorage
// 持久化 + Module 单例 + Context 已废弃。改用：
//
//   NEXT_PUBLIC_API_BASE_URL   后端 base URL（默认 "" = 同源）
//   NEXT_PUBLIC_ENABLE_MSW     MSW Service Worker 启动开关（dev=true / prod=false）
//   NEXT_PUBLIC_API_MODE       显示标签（默认 "msw"），仅 UI 显示
//
// 所有调用方从 `getBaseUrl()` / `getBackend()` 切到 `getApiBaseUrl()` / `getApiMode()` /
// `isMswEnabled()`。

import { env } from "./env";

export function getApiBaseUrl(): string {
  return env.NEXT_PUBLIC_API_BASE_URL || "";
}

export function getApiMode(): string {
  return env.NEXT_PUBLIC_API_MODE || "msw";
}

export function isMswEnabled(): boolean {
  return env.NEXT_PUBLIC_ENABLE_MSW;
}