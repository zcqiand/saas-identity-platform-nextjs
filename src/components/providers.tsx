"use client";

// Providers 容器：QueryClient + TenantProvider + SelectionProvider
// 在 layout.tsx 用 <Providers> 包裹 children（layout.tsx 本身是 server component）
//
// v0.4.0（ADR-0014）：删 BackendProvider；MSW 启动门控由 getBackend() 改为 isMswEnabled()。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { TenantProvider } from "@/state/tenant-context";
import { SelectionProvider } from "@/state/selection-context";
import { installHttpClient } from "@/api/http-client";
import { useTenant } from "@/state/tenant-context";
import { isMswEnabled } from "@/api/backend-config";

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

  // dev 模式 + NEXT_PUBLIC_ENABLE_MSW=true → 启动 service worker 拦截
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!isMswEnabled()) return;
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
      <TenantProvider>
        <SelectionProvider>
          <HttpClientInstaller>{children}</HttpClientInstaller>
        </SelectionProvider>
      </TenantProvider>
    </QueryClientProvider>
  );
}