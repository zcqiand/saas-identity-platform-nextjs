// Test helper: wrap a node with all v0.3.0 providers
// (QueryClient + TenantProvider + SelectionProvider)
//
// v0.4.0（ADR-0014）：删 BackendProvider（runtime 切换已废弃）。
//
// 用法：
//   render(<TestProviders><MyComponent /></TestProviders>);
//
// 测试设置 localStorage 时，TenantProvider 的 lazy initializer 会同步从 localStorage hydrate。
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { TenantProvider } from "../src/state/tenant-context";
import { SelectionProvider } from "../src/state/selection-context";

export function TestProviders({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={queryClient}>
      <TenantProvider>
        <SelectionProvider>{children}</SelectionProvider>
      </TenantProvider>
    </QueryClientProvider>
  );
}

// 兼容旧 export 名（部分测试还在 import）
export { TenantProvider, useTenant } from "../src/state/tenant-context";
export { SelectionProvider, useSelection } from "../src/state/selection-context";