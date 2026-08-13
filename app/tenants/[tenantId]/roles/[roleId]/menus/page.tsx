"use client";

// M09 — 角色 ↔ 菜单授权（按 app 分组的勾选矩阵 + 保存）

import { use, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  adminAppMenusListMenus,
  useAdminAppsListApps,
  useTenantRoleMenusListRoleMenus,
  useTenantRoleMenusSetRoleMenus,
} from "@/api/endpoints/endpoints";
import type { SetRoleMenusRequest } from "@/api/endpoints/endpoints.schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/app/page-header";
import { toApiError } from "@/api/http-client";
import { toast } from "sonner";
import { getTenant } from "@saas/identity-platform-msw/fixtures";

export default function RoleMenuGrantPage({
  params,
}: {
  params: Promise<{ tenantId: string; roleId: string }>;
}) {
  const { tenantId, roleId } = use(params);
  const appsQ = useAdminAppsListApps();
  const apps = appsQ.data?.data?.items ?? [];
  const tenant = tenantId ? getTenant(tenantId) ?? null : null;
  const tenantLabel = tenant ? `${tenant.name}（${tenant.code}）` : "未知租户";
  // 一次性拉所有 app 的 menus（修 apps[0] bug：之前每张 Card 共享同一份 menus）
  const groupsQ = useQuery({
    queryKey: ["roleMenuGrantAllGroups", tenantId, roleId],
    queryFn: async () => {
      return Promise.all(
        apps.map(async (a) => ({
          appCode: a.code,
          appName: a.name,
          menus: (await adminAppMenusListMenus(a.id)).data,
        })),
      );
    },
    enabled: !!tenantId && !!roleId && apps.length > 0,
  });
  const grantQ = useTenantRoleMenusListRoleMenus(tenantId, roleId);
  const saveMut = useTenantRoleMenusSetRoleMenus();

  const [granted, setGranted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = grantQ.data?.data?.menuIds ?? [];
    setGranted(new Set(ids));
  }, [grantQ.data]);

  function toggle(id: string) {
    const next = new Set(granted);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setGranted(next);
  }

  function clearAll() {
    setGranted(new Set());
  }

  async function save() {
    try {
      await saveMut.mutateAsync({
        tenantId,
        roleId,
        data: { menuIds: Array.from(granted) } as SetRoleMenusRequest,
      });
      grantQ.refetch();
      toast.success("菜单授权已保存");
    } catch (err) {
      toast.error(`保存失败：${toApiError(err).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="角色菜单授权"
        description={
          <>
            租户{" "}
            <span className="font-semibold text-slate-700">
              {tenantLabel}
            </span>{" "}
            / 角色 <span className="font-mono text-xs">{roleId.slice(0, 8) || "—"}</span>
          </>
        }
        actions={
          <div className="flex gap-2">
            <Button variant="outline" data-fn="M09.F02.I03" onClick={clearAll}>
              清空
            </Button>
            <Button
              data-fn="M09.F02.I02"
              disabled={saveMut.isPending}
              onClick={save}
            >
              {saveMut.isPending ? "保存中…" : `保存 (${granted.size})`}
            </Button>
          </div>
        }
      />

      {(groupsQ.data ?? []).map((g) => (
        <Card key={g.appCode}>
          <CardHeader>
            <CardTitle>
              {g.appName}
              <span className="ml-2 text-xs font-mono text-slate-500">({g.appCode})</span>
              <span className="ml-2 text-xs font-mono text-slate-500">
                {g.menus.length} 项
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {g.menus.map((m) => {
              const checked = granted.has(m.id);
              return (
                <label
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2 rounded hover:bg-slate-50 cursor-pointer"
                  data-testid="menu-grant-row"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(m.id)}
                    className="h-4 w-4"
                  />
                  <span className="font-medium text-sm">{m.name}</span>
                  <span className="font-mono text-xs text-slate-500">{m.code}</span>
                </label>
              );
            })}
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm text-slate-600">当前授权摘要</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm">
            共勾选 <span className="font-bold">{granted.size}</span> 项菜单
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
