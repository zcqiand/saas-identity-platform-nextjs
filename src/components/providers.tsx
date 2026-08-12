"use client";

// Providers 容器：QueryClient + BackendProvider + TenantProvider
// 在 layout.tsx 用 <Providers> 包裹 children（layout.tsx 本身是 server component）
//
// v0.2.0 装配顺序：
//   QueryClient（react-query）
//   → BackendProvider（lazy hydrate 模块单例）
//   → TenantProvider（lazy hydrate session）

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { BackendProvider } from "@/state/backend-context";
import { TenantProvider } from "@/state/tenant-context";

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 5_000, retry: false } },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <BackendProvider>
        <TenantProvider>{children}</TenantProvider>
      </BackendProvider>
    </QueryClientProvider>
  );
}