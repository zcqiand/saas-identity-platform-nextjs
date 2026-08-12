// HTTP client — axios + 1:1 endpoint mapping via local orval codegen.
//
// 端点 1:1 映射由 src/api/endpoints/endpoints.ts（本地 orval 产物）提供
//（orval 从 ../saas-identity-platform-shared/generated/openapi/openapi.yaml 生成，
// 每个端点对应一个具名函数 + 一个 react-query hook）。
// 本文件做两件事：
//   1) 装 axios 拦截器：每次请求从运行时配置（backend-config）拿 baseUrl，
//      从 getToken callback 拿 token，写进 Authorization 头
//   2) 提供 ApiError 封装（low-level fetch 走 axios 错误时统一）

import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { getBaseUrl } from "./backend-config";

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
 */
export function installHttpClient(getToken: () => string | null): void {
  axios.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    config.baseURL = getBaseUrl();
    const token = getToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
    return config;
  });
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

  const res = await fetch(`${getBaseUrl()}${path}`, {
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

export { getBaseUrl, getBackend } from "./backend-config";