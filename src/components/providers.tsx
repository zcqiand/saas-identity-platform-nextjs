"use client";

// Providers 容器：QueryClient + BackendProvider + TenantProvider + SelectionProvider
// 在 layout.tsx 用 <Providers> 包裹 children（layout.tsx 本身是 server component）
//
// v0.3.0 装配顺序：
//   MSW worker 启动（dev + backend == "msw"，拦截 /api/v1/* 走浏览器内 mock）
//   → axios 拦截器装（baseURL / Bearer token）
//   → QueryClient（react-query）
//   → BackendProvider（lazy hydrate 模块单例）
//   → TenantProvider（lazy hydrate session）
//   → SelectionProvider（lazy hydrate localStorage）

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { BackendProvider } from "@/state/backend-context";
import { TenantProvider } from "@/state/tenant-context";
import { SelectionProvider } from "@/state/selection-context";
import { installHttpClient } from "@/api/http-client";
import { useTenant } from "@/state/tenant-context";
import { getBackend } from "@/api/backend-config";

function HttpClientInstaller({ children }: { children: ReactNode }) {
  const tenant = useTenant();
  // installHttpClient 必须在 useQuery 之前调一次（拦截器全局）
  useEffect(() => {
    installHttpClient(() => tenant.accessToken);
  }, [tenant.accessToken]);
  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5_000, retry: false } },
      }),
  );

  // dev 模式 + backend == "msw" → 启动 service worker 拦截
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (getBackend() !== "msw") return;
    // dynamic import：msw + browser entry 仅在 client 启动时按需加载
    void import("@saas/identity-platform-msw/browser").then(({ setupBrowserMocks }) =>
      setupBrowserMocks().catch(() => {
        // service worker 注册失败时静默（http-client 会回落到真实请求并得到 404/500，
        // gate 集成测试环境不依赖 msw 因为它直接 mock 了 @/api/endpoints/endpoints）
      }),
    );
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BackendProvider>
        <TenantProvider>
          <SelectionProvider>
            <HttpClientInstaller>{children}</HttpClientInstaller>
          </SelectionProvider>
        </TenantProvider>
      </BackendProvider>
    </QueryClientProvider>
  );
}
