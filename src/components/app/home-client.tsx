"use client";

import Link from "next/link";
import { Building2, Users, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { cn } from "@/lib/utils";

/**
 * M01.F05 控制台首页 — Home 组件（client component）
 *
 * 三张聚合卡：租户数 / 用户总数 / 今日登录数。
 *   - 数据由 server component (src/app/page.tsx) 调 getDashboardCounts() 取好，通过 props 传下来
 *   - 客户端不做 fetch、不直连 DB（项目 CLAUDE.md 第二节「禁止 client 组件内联 fetch / 直连数据库」）
 *   - 每张卡都用 <Link href> 包裹，是声明式导航：跳 /tenants /users /orgs
 *   - data-fn="M01.F05.I01" 挂在 Link 元素上（L5 reachability 验证）
 */

interface DashboardCounts {
  tenants: number;
  users: number;
  todayLogins: number;
}

interface CardSpec {
  slug: "tenants" | "users" | "logins";
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
}

const CARDS: readonly CardSpec[] = [
  {
    slug: "tenants",
    title: "租户数",
    description: "当前系统中所有租户",
    href: "/tenants",
    icon: <Building2 className="text-muted-foreground size-4" />,
  },
  {
    slug: "users",
    title: "用户总数",
    description: "所有租户的累计用户",
    href: "/users",
    icon: <Users className="text-muted-foreground size-4" />,
  },
  {
    slug: "logins",
    title: "今日登录数",
    description: "audit_logs 中今日 action='login' 的条数",
    href: "/audit-logs",
    icon: <Activity className="text-muted-foreground size-4" />,
  },
] as const;

export function Home({ counts }: { counts: DashboardCounts }) {
  const valueBySlug: Record<CardSpec["slug"], number> = {
    tenants: counts.tenants,
    users: counts.users,
    logins: counts.todayLogins,
  };

  return (
    <div data-testid="dashboard-page" data-fn="M01.F05.I01" className="space-y-6">
      <PageHeader
        title="仪表盘"
        description="SaaS 统一身份管理 · 概览与今日动态"
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.slug}
            href={card.href}
            data-testid={`dashboard-card-${card.slug}`}
            data-fn="M01.F05.I03"
            data-fn-href={card.href}
            aria-label={`查看${card.title}`}
            className="focus-visible:ring-primary rounded-xl focus:outline-none focus-visible:ring-2"
          >
            <Card
              className={cn(
                "hover:border-primary/50 h-full transition-colors",
              )}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  {card.icon}
                  {card.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  data-testid={`dashboard-card-${card.slug}-value`}
                  className="text-3xl font-semibold tabular-nums"
                >
                  {valueBySlug[card.slug]}
                </div>
                <p className="text-muted-foreground mt-1 text-xs">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
