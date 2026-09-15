// HTTP client — axios + 1:1 endpoint mapping via local orval codegen.
//
// 端点 1:1 映射由 src/api/endpoints/endpoints.ts（本地 orval 产物）提供
//（orval 从 ../saas-identity-platform-shared/generated/openapi/openapi.yaml 生成，
// 每个端点对应一个具名函数 + 一个 react-query hook）。
// 本文件做两件事：
//   1) 装 axios 拦截器：每次请求从部署期配置（NEXT_PUBLIC_API_BASE_URL）拿 baseUrl，
//      从 getToken callback 拿 token，写进 Authorization 头
//   2) 提供 ApiError 封装（low-level fetch 走 axios 错误时统一）
//
// ADR-0014：runtime baseUrl 已废弃，改走 env-driven 单 URL。

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getApiBaseUrl } from "./backend-config";

export class ApiError extends Error {
  status: number;
  body: any;
  constructor(status: number, body: any, message?: string) {
    super(message ?? `API ${status}`);
    this.status = status;
    this.body = body;
  }
}

/** 从 axios 错误构造 ApiError（响应体里的 ErrorResponse 直接透传） */
export function toApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const axErr = err as AxiosError<any>;
    return new ApiError(axErr.response?.status ?? 0, axErr.response?.data ?? null, axErr.message);
  }
  if (err instanceof ApiError) return err;
  if (err instanceof Error) return new ApiError(0, null, err.message);
  return new ApiError(0, null, String(err));
}

/**
 * 注入运行时 baseUrl + Bearer token。
 * 在 main.tsx 启动时调一次；getToken 用 callback 形式避免循环依赖
 * （tenant-context → http-client 不能反向指）。
 *
 * 幂等（2026-09-14）：重复 install 先 eject 上一次的拦截器再装新的。
 * axios 请求拦截器后注册先跑、旧的总在链尾收尾——若只叠加不 eject，
 * 旧闭包捕获的过期 token 会在链尾把 Authorization 头重新覆盖一遍，
 * 重新登录拿到的新 token 永远被盖掉（表现为 authorize 401
 * "saas session or Bearer token required"，且仅当首帧 token 过期后复现）。
 */

/** 401 时清本地会话并跳登录页（保留后端切换选择）。 */
function handleUnauthorized(): void {
  for (const key of ["saas.tenant", "saas.selected.tenant", "saas.selected.app"]) {
    try { window.localStorage.removeItem(key); } catch { /* ignore */ }
  }
  window.location.assign("/login");
}

let ejectRequest: (() => void) | null = null;
let ejectResponse: (() => void) | null = null;

export function installHttpClient(getToken: () => string | null): void {
  ejectRequest?.();
  ejectResponse?.();
  const requestId = axios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    config.baseURL = getApiBaseUrl();
    const token = getToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });
  ejectRequest = () => axios.interceptors.request.eject(requestId);
    // 401（token 过期/无效）→ 清本地会话并踢回登录页重新登录（用户裁定 2026-09-12）。
    const responseId = axios.interceptors.response.use(
      (res) => res,
      (err) => {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          const url = err.config?.url ?? "";
          const isAuthFlow = /\/api\/v1\/(auth|oauth)\//.test(url);
          const onLogin = window.location.pathname.startsWith("/login");
          if (!isAuthFlow && !onLogin) {
            handleUnauthorized();
          }
        }
        return Promise.reject(err);
      },
    );
  ejectResponse = () => axios.interceptors.response.eject(responseId);
}

// 兼容老调用方：低阶 fetch 包装（仅用于不走 axios 的兜底场景）
export interface ApiRequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  headers?: Record<string, string>;
}

export async function apiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
  token?: string | null,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${getApiBaseUrl()}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export { getApiBaseUrl, getApiMode } from "./backend-config";