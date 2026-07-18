"use client";

import { SidebarNav } from "@/components/app/sidebar-nav";
import { applyTheme } from "@/lib/theme";
import { getCurrentTenant } from "@/lib/tenant-store";

/**
 * M01.F01.I08 租户布局与切换 — ProtectedLayout client shell
 *
 * 测试期望：这个组件自己从 tenantStore.getCurrentTenant() 读当前 tenant，
 * 然后调 applyTheme / clearTheme 渲染 <style>。这样 jsdom 测试不用传 props。
 *
 * 真实部署时：(protected)/layout.tsx (server) 在 SSR 启动时同步 cookie → tenantStore，
 * 本组件渲染时已经能拿到 tenant。CSS 用属性选择器 `[data-tenant="..."]`，保证 hydration 后无 flash。
 */
export interface ProtectedLayoutProps {
  children: React.ReactNode;
}

export function ProtectedLayout({ children }: ProtectedLayoutProps) {
  const tenant = getCurrentTenant();
  const css = tenant ? applyTheme(tenant.theme) : null;

  return (
    <div
      data-testid="protected-layout"
      data-fn="M01.F01.I08"
      data-tenant={tenant?.theme ?? ""}
      className="flex min-h-screen"
    >
      {css !== null ? <style dangerouslySetInnerHTML={{ __html: css }} /> : null}
      <SidebarNav />
      <main className="flex-1 bg-background p-6">{children}</main>
    </div>
  );
}