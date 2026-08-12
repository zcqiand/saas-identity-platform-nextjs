// Test helper: wrap a node with all v0.2.0 providers (QueryClient + BackendProvider + TenantProvider)
//
// 用法：
//   render(<Wrapper><MyComponent /></Wrapper>);
//
// 测试设置 localStorage 时，TenantProvider 的 lazy initializer 会同步从 localStorage hydrate。
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { BackendProvider } from "../src/state/backend-context";
import { TenantProvider } from "../src/state/tenant-context";

export function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <BackendProvider>
        <TenantProvider>{children}</TenantProvider>
      </BackendProvider>
    </QueryClientProvider>
  );
}

// 兼容旧 export 名（部分测试还在 import）
export { TenantProvider, useTenant } from "../src/state/tenant-context";
export { BackendProvider, useBackend } from "../src/state/backend-context";