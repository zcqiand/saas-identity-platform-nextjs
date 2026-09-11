// AppShell — top bar with breadcrumbs + left sidebar + main content.
//
// Next.js App Router 版本：children prop 替代 React Router <Outlet />。
// Sidebar links with `:tenantId` placeholder are dynamically substituted with
// `selectedTenantId` (from SelectionContext). This way clicking "租户成员" while
// tenant = globex goes to `/tenants/globex/members`, not literal `/tenants/:tenantId/members`.

"use client";

import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  KeyRound,
  ScrollText,
  LogOut,
  ChevronRight,
  Home,
} from "lucide-react";
import { SidebarNav } from "./sidebar-nav";
import { buildNavItems } from "./nav-items";
import { TenantSwitcher } from "@/components/tenant-switcher";
import { BackendBadge } from "./backend-badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { useQuery } from "@tanstack/react-query";
import { adminTenantsListTenants } from "@/api/endpoints/endpoints";
import { useTenant } from "@/state/tenant-context";
import { useSelection } from "@/state/selection-context";

interface Crumb {
  label: string;
  to: string;
  icon?: ReactNode;
  hint?: string;
}

const SUB_PATH_LABEL: Record<string, string> = {
  users: "用户",
  roles: "角色",
  applications: "应用",
  menus: "菜单",
  apps: "应用",
};

// 面包屑租户名：getTenant（msw 包内嵌 fixtures）的 HTTP 替代（ADR-0012 运行时
// import 清零）。拉一次租户列表建 id->tenant 字典；加载中/未命中显示「未知租户」。
function useTenantMap(): Map<string, { id: string; name: string; code: string }> {
  const q = useQuery({
    queryKey: ["adminTenantsListTenants", "breadcrumb"],
    queryFn: async () => (await adminTenantsListTenants()).data.items,
    staleTime: Infinity,
  });
  return new Map((q.data ?? []).map((t) => [t.id, t]));
}

function useBreadcrumbs(pathname: string, fallbackTenantId: string): Crumb[] {
  const tenantById = useTenantMap();
  if (pathname === "/tenants" || pathname === "/") {
    return [{ label: "首页", to: "/tenants", icon: <Home className="h-3.5 w-3.5" /> }];
  }
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [
    { label: "首页", to: "/tenants", icon: <Home className="h-3.5 w-3.5" /> },
  ];
  let path = "";
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    path += "/" + seg;
    const prev = i > 0 ? segments[i - 1] : null;
    if (seg === "tenants" && i + 1 < segments.length) continue;
    if (prev === "tenants") {
      const tenant = tenantById.get(seg) ?? tenantById.get(fallbackTenantId);
      if (tenant) {
        crumbs.push({ label: tenant.name, to: path, hint: tenant.code });
      } else {
        crumbs.push({ label: "未知租户", to: path, hint: seg.slice(0, 8) });
      }
      continue;
    }
    crumbs.push({ label: SUB_PATH_LABEL[seg] ?? seg, to: path });
  }
  return crumbs;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { currentTenantId, logout } = useTenant();
  const { selectedTenant } = useSelection();
  const tenantForNav =
    selectedTenant.id ?? currentTenantId ?? "00000000-0000-0000-0000-000000000001";
  const crumbs = useBreadcrumbs(pathname, tenantForNav);

  const navItems = useMemo(() => buildNavItems(tenantForNav), [tenantForNav]);

  async function onLogout() {
    await logout();
    router.push("/login");
  }

  // 登出按钮（用户裁定 2026-09-11：移到右上角，切换租户旁）
  const logoutButton = (
    <Button
      variant="ghost"
      size="sm"
      onClick={onLogout}
      className="gap-2 text-slate-600 hover:text-slate-900"
      data-testid="logout-btn"
      data-fn="M01.F04.I06"
    >
      <LogOut className="h-4 w-4" />
      登出
    </Button>
  );

  const footerExtras = <BackendBadge />;

  return (
    <div className="min-h-screen flex bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <Toaster />
      <SidebarNav items={navItems} footerExtras={footerExtras} />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 bg-white/80 backdrop-blur border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
          <nav className="flex items-center gap-1 text-sm" aria-label="breadcrumb">
            {crumbs.map((c, i) => {
              const isLast = i === crumbs.length - 1;
              return (
                <div key={c.to} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-400" />}
                  {isLast ? (
                    <span className="flex items-center gap-1.5 text-slate-900 font-medium">
                      {c.icon}
                      {c.label}
                      {c.hint && (
                        <span className="text-slate-400 font-mono text-xs">({c.hint})</span>
                      )}
                    </span>
                  ) : (
                    <Link
                      href={c.to}
                      className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      {c.icon}
                      {c.label}
                      {c.hint && (
                        <span className="text-slate-400 font-mono text-xs">({c.hint})</span>
                      )}
                    </Link>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="flex items-center gap-3">
            {currentTenantId && <TenantSwitcher />}
            {logoutButton}
          </div>
        </header>
        <Separator />
        <main className="flex-1 overflow-auto">
          <div className="max-w-6xl mx-auto p-6">{children}</div>
        </main>
      </div>
    </div>
  );
}
