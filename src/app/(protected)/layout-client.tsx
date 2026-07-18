"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SidebarNav } from "@/components/app/sidebar-nav";
import { applyTheme, clearTheme } from "@/lib/theme";

/**
 * M01.F01.I08 租户布局与切换 — ProtectedLayout client shell
 *
 * server component (layout.tsx) 在 SSR 启动时：
 *   1. 读 cookie → 调 setCurrentTenant(id)
 *   2. 调 applyTheme / clearTheme 得 CSS 字符串
 *   3. 把 CSS + 当前 tenant name 透传给本组件
 *
 * client 端根据当前 tenant 用 <style> 注入 CSS + 用 SidebarNav 跑 nav 激活态
 */
export interface ProtectedLayoutProps {
  children: React.ReactNode;
  themeCss?: string;
  currentTenantName?: string | null;
}

export function ProtectedLayout({ children, themeCss = "", currentTenantName = null }: ProtectedLayoutProps) {
  const [css, setCss] = useState(themeCss);

  // hydration 后让 SidebarNav 跑 usePathname
  useEffect(() => {
    setCss(themeCss);
  }, [themeCss]);

  return (
    <div
      data-testid="protected-layout"
      data-fn="M01.F01.I08"
      data-tenant={currentTenantName ?? ""}
      className="flex min-h-screen"
    >
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <SidebarNav />
      <main className="flex-1 bg-background p-6">{children}</main>
    </div>
  );
}

/** Helper export for tests / future layouts that want to test theme switching */
export function applyClearTheme(): string {
  return clearTheme();
}

export function applyDefaultTheme(): string {
  return applyTheme("default");
}

export function applyDarkTheme(): string {
  return applyTheme("dark");
}

export function applyLightTheme(): string {
  return applyTheme("light");
}

/** (reserved) Card/Button re-exports for backwards compat — older pages import from here */
export { Card, CardContent, CardHeader, CardTitle, Button };