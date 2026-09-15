"use client";

// Providers 容器：QueryClient + TenantProvider + SelectionProvider
// 在 layout.tsx 用 <Providers> 包裹 children（layout.tsx 本身是 server component）
//
// v0.4.0（ADR-0014）：删 BackendProvider。
// v0.3.0（ADR-0012 B 强度）：完全删除 MSW Service Worker 模式 —— dev 路径走独立
// HTTP server（@saas/identity-platform-msw/src/server.ts 起在 :5100）。

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { TenantProvider } from "@/state/tenant-context";
import { SelectionProvider } from "@/state/selection-context";
import { installHttpClient } from "@/api/http-client";
import { useTenant } from "@/state/tenant-context";

function HttpClientInstaller({ children }: { children: ReactNode }) {
  const tenant = useTenant();
  // getToken 走 ref 每请求读最新 token；拦截器只装一次（见 installHttpClient 幂等注释，
  // 反复 install 叠加旧拦截器会用过期 token 覆盖 Authorization 头 —— 2026-09-14 authorize 401 根因）。
  const tokenRef = useRef<string | null>(tenant.accessToken);
  tokenRef.current = tenant.accessToken;
  // installHttpClient 必须在 useQuery 之前调一次（拦截器全局）
  useEffect(() => {
    installHttpClient(() => tokenRef.current);
  }, []);
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