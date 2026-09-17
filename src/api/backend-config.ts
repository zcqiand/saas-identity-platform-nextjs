// 后端配置：env-driven 单 URL（ADR-0014）。
//
//   NEXT_PUBLIC_API_BASE_URL   后端 base URL（默认 "" = 同源本仓 /api/v1）
//   NEXT_PUBLIC_API_MODE       显示标签（默认 "nextjs"），仅 UI 显示
//
// 2026-09-17 msw 仓已删（剔除设计 Phase 4 提前）：dev 默认后端从 msw-http :5100
// 切到同源本仓 API routes；msw 切换项与 prodBaseUrl 一并移除。
//
// 所有调用方从 `getBaseUrl()` / `getBackend()` 切到 `getApiBaseUrl()` / `getApiMode()`。

import { env } from "./env";

// === 2026-09-11 用户裁定：恢复运行时切换（用户指令覆盖 ADR-0014 dev 单 URL）===
// 切换器是 dev/local 诊断工具；2026-09-13 用户裁定补 prod 分流（同 react/vue）：
// prod 构建下选择映射到 prod 域名。端口表 = multi-repo-family §6。
const IS_PROD_BUILD = process.env.NODE_ENV === "production";

export const BACKENDS = [
  { key: "nextjs", baseUrl: "http://localhost:5101", prodBaseUrl: "https://saas-nextjs.xiangru.uk" },
  { key: "aspnetcore", baseUrl: "http://localhost:5104", prodBaseUrl: "https://saas-aspnetcore.xiangru.uk" },
  { key: "springboot", baseUrl: "http://localhost:5105", prodBaseUrl: "https://saas-springboot.xiangru.uk" },
] as const;

/** prod 可选后端：剔除无 prodBaseUrl 的项（当前四项都有 prod 部署）。 */
export const SELECTABLE_BACKENDS = BACKENDS.filter(
  (b) => !IS_PROD_BUILD || b.prodBaseUrl !== null,
);

function resolveBaseUrl(b: (typeof BACKENDS)[number]): string {
  return (IS_PROD_BUILD && b.prodBaseUrl) || b.baseUrl;
}

/** 选择 key → 实际 base URL（prod 返回 prod 域名，dev 返回 localhost）。 */
export function resolveSelectedBackendUrl(key: string): string {
  const hit = BACKENDS.find((b) => b.key === key);
  return hit ? resolveBaseUrl(hit) : "";
}

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
  // 运行时切换优先；未选择时走 env。prod 下命中 SELECTABLE 项返回 prod 域名，
  // 未知/已下线的 key（localStorage 跨构建遗留）落空 → 走 env 默认。
  const selected = getSelectedBackend();
  if (selected) {
    const hit = SELECTABLE_BACKENDS.find((b) => b.key === selected);
    if (hit) return resolveBaseUrl(hit);
  }
  // 用 ?? 而非 ||：NEXT_PUBLIC_API_BASE_URL="" 时应走同源相对路径
  //（prod nginx 反代到容器 / dev 本仓 API routes），"" 不是 nullish 必须保留。
  // dev 没设 env 时 fallback 同源（msw 剔除后无独立假后端可指）。
  return env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

export function getApiMode(): string {
  return env.NEXT_PUBLIC_API_MODE ?? "nextjs";
}