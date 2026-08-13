"use client";

// RequireAuth — Next.js App Router 路由守卫。
//
// 关键：避免 hydration mismatch —— server 渲染时 localStorage 不可用，
// isAuthenticated 默认 false → 渲染「跳转登录中…」；client mount 后
// 才从 localStorage 读取真实 session，然后切换到 AppShell 或 redirect。
//
// 包装（顺序）：
//   path === "/login" → 直接渲染 children（不走 AppShell）
//   path !== "/login" && isAuthenticated → 渲染 <AppShell>{children}</AppShell>
//   path !== "/login" && !isAuthenticated → 渲染 redirect after mount

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTenant } from "@/state/tenant-context";
import { AppShell } from "@/components/app/app-shell";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useTenant();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // 客户端 mount 后才读 localStorage —— 避免 hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // redirect 仅在客户端跑
  useEffect(() => {
    if (!mounted) return;
    if (!isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }
    if (isAuthenticated && pathname === "/login") {
      router.replace("/tenants");
    }
  }, [mounted, isAuthenticated, pathname, router]);

  // 未 mount 之前：服务端 / 客户端首屏统一渲染 loader 占位，避免 mismatch
  if (!mounted) {
    return (
      <p style={{ padding: 24 }}>跳转登录中…</p>
    );
  }

  // /login 路由不包 AppShell
  if (pathname === "/login") {
    return <>{children}</>;
  }

  // 已登录且不在 /login → AppShell 包裹
  if (isAuthenticated) {
    return <AppShell>{children}</AppShell>;
  }

  // 已 mount 但未登录 → 即将跳转，显示 loader 占位
  return <p style={{ padding: 24 }}>跳转登录中…</p>;
}
