"use client";

import { SidebarNav } from "@/components/app/sidebar-nav";

/**
 * M01.F01.I08 租户布局与切换 — ProtectedLayout client shell
 *
 * 接收 server layout 透传过来的 themeCss（已算好的 CSS 字符串）和
 * currentTenantName。client 端只是渲染，不调任何 server-only 模块。
 *
 * 测试期望：vitest 下直接调 <ProtectedLayout> 不传 props 时也能正常工作
 * （默认 themeCss="" → 不渲染 <style>）。
 */
export interface ProtectedLayoutProps {
  children: React.ReactNode;
  themeCss?: string;
  currentTenantName?: string | null;
}

export function ProtectedLayout({
  children,
  themeCss = "",
  currentTenantName = null,
}: ProtectedLayoutProps) {
  return (
    <div
      data-testid="protected-layout"
      data-fn="M01.F01.I08"
      data-tenant={currentTenantName ?? ""}
      className="flex min-h-screen"
    >
      {themeCss ? <style dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
      <SidebarNav />
      <main className="flex-1 bg-background p-6">{children}</main>
    </div>
  );
}