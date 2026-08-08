"use client";

import { Building2, Users, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTenantFilter } from "@/lib/tenant-filter-store";

/**
 * M01.F01.I08（复用）— 5 个管理页租户树 sidebar 组件
 *
 * 设计：
 *   - 客户端组件，受 T3 sub-layout 嵌入受保护路由的左栏（240px 宽）
 *   - URL 是单一真相源：useTenantFilter() 暴露 selectedTenantId / setTenant / clear
 *     setTenant(id) → URL 变为 `?tenant=id`；clear() → URL 去掉 ?tenant=
 *   - 节点列表 hardcode（2 个租户）：acme + tenant-lab
 *     v0.5.x 计划从 useSWR('/api/tenants') 拉取真列表
 *   - 节点附「N 部门 / N 用户 / N 角色」汇总：当前 hardcode（avoid SWR loading 复杂度）
 *     v0.5.x 计划从 /api/departments?tenant= /users?tenant= /roles?tenant= 拉真计数
 *   - 选中态：data-active="true" + aria-current="true"（a11y 标注）
 *
 * 入口：根 aside 挂 `data-testid="tenant-tree-sidebar"` + `data-fn="M01.F01.I08"`。
 * L5 reachability 验证：fnReporter 会数 `data-fn="M01.F01.I08"` 的物理存在。
 */

interface TenantNode {
  id: string;
  code: string;
  name: string;
  counts: {
    departments: number;
    users: number;
    roles: number;
  };
}

/**
 * TODO v0.5.x — 把计数换成 useSWR：
 *   const { data: depts } = useSWR(`/api/departments?tenant=${id}`, fetcher);
 * 当前 hardcode 仅为 unblock UI（项目要求不引入新依赖）。
 */
const SEED_COUNTS: Record<string, TenantNode["counts"]> = {
  acme: { departments: 2, users: 13, roles: 10 },
  "tenant-lab": { departments: 0, users: 2, roles: 2 },
};

const TENANTS: readonly TenantNode[] = [
  {
    id: "acme",
    code: "acme",
    name: "ACME 集团",
    counts: SEED_COUNTS.acme!,
  },
  {
    id: "tenant-lab",
    code: "tenant-lab",
    name: "Tenant Lab",
    counts: SEED_COUNTS["tenant-lab"]!,
  },
] as const;

export function TenantTreeSidebar() {
  const { selectedTenantId, setTenant, clear } = useTenantFilter();

  return (
    <aside
      data-testid="tenant-tree-sidebar"
      data-fn="M01.F01.I08"
      aria-label="租户列表"
      className="bg-card text-card-foreground flex w-60 shrink-0 flex-col border-r"
    >
      <div className="border-b p-3">
        <h2 className="text-sm font-semibold">租户</h2>
        <p className="text-muted-foreground mt-0.5 text-xs">
          切换租户过滤 5 个管理页
        </p>
      </div>

      <div className="p-2">
        <Button
          variant={selectedTenantId === null ? "default" : "ghost"}
          size="sm"
          className="w-full justify-start"
          onClick={clear}
          data-testid="tenant-tree-clear"
        >
          全部
        </Button>
      </div>

      <ul className="flex-1 space-y-1 overflow-y-auto p-2" role="tree">
        {TENANTS.map((t) => {
          const isActive = selectedTenantId === t.id;
          return (
            <li key={t.id} role="treeitem">
              <button
                type="button"
                onClick={() => setTenant(t.id)}
                data-testid={`tenant-node-${t.id}`}
                data-active={isActive ? "true" : undefined}
                aria-current={isActive ? "true" : undefined}
                aria-selected={isActive}
                className={cn(
                  "hover:bg-accent hover:text-accent-foreground flex w-full flex-col items-start gap-1 rounded-md px-2 py-2 text-left text-sm transition-colors",
                  isActive && "bg-accent text-accent-foreground font-medium",
                )}
              >
                <span className="flex items-center gap-2">
                  <Building2 className="text-muted-foreground size-4 shrink-0" />
                  <span>{t.name}</span>
                </span>
                <span className="text-muted-foreground flex items-center gap-3 pl-6 text-xs">
                  <span className="flex items-center gap-1" data-testid={`tenant-node-${t.id}-departments`}>
                    <Users className="size-3" />
                    {t.counts.departments} 部门
                  </span>
                  <span className="flex items-center gap-1" data-testid={`tenant-node-${t.id}-users`}>
                    <Users className="size-3" />
                    {t.counts.users} 用户
                  </span>
                  <span className="flex items-center gap-1" data-testid={`tenant-node-${t.id}-roles`}>
                    <Shield className="size-3" />
                    {t.counts.roles} 角色
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}