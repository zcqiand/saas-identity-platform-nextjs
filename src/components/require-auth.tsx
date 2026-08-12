"use client";

// RequireAuth — Next.js App Router 路由守卫。
//
// 与 react-router 不同，App Router 用 redirect()（server）或 useRouter.replace()（client）。
// 这里选 client 方案：组件 mount 时检查 useTenant().isAuthenticated，未登录则 replace 到 /login。
// 配合 layout.tsx 的 TenantProvider（lazy initializer 同步读 localStorage），
// 避免首屏渲染时 useTenant 已 hydrate 过 → 守卫不会误判。

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTenant } from "@/state/tenant-context";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useTenant();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isAuthenticated && pathname !== "/login") {
      router.replace("/login");
    }
    if (isAuthenticated && pathname === "/login") {
      router.replace("/tenants");
    }
  }, [isAuthenticated, pathname, router]);

  if (!isAuthenticated && pathname !== "/login") {
    return <p style={{ padding: 24 }}>跳转登录中…</p>;
  }

  return <>{children}</>;
}