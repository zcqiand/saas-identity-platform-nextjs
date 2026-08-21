"use client";

// Providers 容器：QueryClient + TenantProvider + SelectionProvider
// 在 layout.tsx 用 <Providers> 包裹 children（layout.tsx 本身是 server component）
//
// v0.4.0（ADR-0014）：删 BackendProvider；MSW 启动门控由 getBackend() 改为 isMswEnabled()。
// v0.3.0（ADR-0012 B 强度）：完全删除 MSW Service Worker 模式 —— dev 路径走独立
// HTTP server（@saas/identity-platform-msw/src/server.ts 起在 :5174），不再需要
// isMswEnabled 门控 + dynamic import(@saas/.../browser)。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { TenantProvider } from "@/state/tenant-context";
import { SelectionProvider } from "@/state/selection-context";
import { installHttpClient } from "@/api/http-client";
import { useTenant } from "@/state/tenant-context";

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