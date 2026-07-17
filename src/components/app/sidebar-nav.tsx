"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * M01.F05 控制台首页 + 全受保护区 — 左侧菜单导航
 *
 * 与 REF saas-identity-platform/src/app/layouts/PlatformLayout.tsx 1:1 对齐：
 *   - 左侧固定 224px (w-56) 侧栏
 *   - 顶部品牌区「SaaS 统一身份管理」
 *   - nav 列出受保护路由；用 usePathname 算 active 态
 *
 * 菜单项（保持稳定顺序，跟 APP_MENU_SEED 同步——但 UI 直接硬编码避免多一次 DB 读）：
 *   仪表盘 /           M01.F05
 *   租户管理 /tenants  M01.F01
 *   组织架构 /orgs     M02.F01
 *   用户管理 /users    M02.F02
 *   岗位管理 /positions M02.F03
 *   角色管理 /roles    M03.F01
 *   用户组 /user-groups M03.F03
 *   应用管理 /apps     M04.F01
 *   API 凭据 /api-keys M04.F02
 *   审计日志 /audit-logs M05.F01
 *   平台设置 /settings M06
 */

interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

const NAV_ITEMS: readonly NavItem[] = [
  { href: "/", label: "仪表盘", exact: true },
  { href: "/tenants", label: "租户管理" },
  { href: "/orgs", label: "组织架构" },
  { href: "/users", label: "用户管理" },
  { href: "/positions", label: "岗位管理" },
  { href: "/roles", label: "角色管理" },
  { href: "/user-groups", label: "用户组" },
  { href: "/apps", label: "应用管理" },
  { href: "/api-keys", label: "API 凭据" },
  { href: "/audit-logs", label: "审计日志" },
  { href: "/settings", label: "平台设置" },
] as const;

export function SidebarNav() {
  const pathname = usePathname() ?? "/";

  return (
    <aside
      data-testid="sidebar-nav"
      className="bg-sidebar text-sidebar-foreground flex w-56 shrink-0 flex-col border-r"
    >
      <div className="border-sidebar-border border-b p-4">
        <h1 className="text-base font-bold">SaaS IAM</h1>
        <p className="text-muted-foreground text-xs">统一身份管理 · 控制台</p>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.exact
            ? pathname === item.href
            : pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              data-testid={`sidebar-link-${item.href.replace(/^\//, "") || "root"}`}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "block rounded px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
