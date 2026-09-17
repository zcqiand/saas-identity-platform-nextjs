"use client";

// M00.F05 — 租户应用订阅列表（subscribe / update / remove）

import { use, useState } from "react";
import {
  useAdminClientsListClients,
  useAdminTenantsGetTenant,
  useTenantApplicationsListTenantApplications,
  useTenantApplicationsRemoveTenantApplication,
  useTenantApplicationsSubscribeTenantApplication,
  useTenantApplicationsUpdateTenantApplication,
} from "@/api/endpoints";
import type {
  SubscribeTenantApplicationRequest,
  TenantApplication,
  UpdateTenantApplicationRequest,
} from "@/api/endpoints.schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { CrudDialog, type FieldDef } from "@/components/app/crud-dialog";
import { toApiError } from "@/api/http-client";
import { toast } from "sonner";

/** M00.F05 状态码（家族约定 2026-09-10）：0=待激活 / 1=启用 / 2=停用 */
const STATUS_OPTIONS = [
  { value: "0", label: "待激活" },
  { value: "1", label: "启用" },
  { value: "2", label: "停用" },
];

const SUBSCRIBE_FIELDS: FieldDef[] = [
  { name: "clientId", label: "Client ID", required: true, placeholder: "lab-management" },
  { name: "expireTime", label: "到期时间", placeholder: "2027-01-01T00:00:00Z（留空=永久）" },
];

const UPDATE_FIELDS: FieldDef[] = [
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    defaultValue: "1",
    options: STATUS_OPTIONS,
  },
  { name: "expireTime", label: "到期时间", placeholder: "留空=永久" },
];

function statusLabel(s: number): string {
  return STATUS_OPTIONS.find((o) => o.value === String(s))?.label ?? `状态 ${s}`;
}

function formatExpire(expireTime?: string): string {
  if (!expireTime) return "永久";
  return expireTime.slice(0, 10);
}

export default function TenantApplicationsListPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  const { tenantId } = use(params);
  const tenantQ = useAdminTenantsGetTenant(tenantId, {
    query: { enabled: !!tenantId },
  });
  const tenant = tenantQ.data?.data ?? null;
  const tenantLabel = tenant ? `租户 ${tenant.name}（${tenant.tenantKey}）` : "租户未知";

  const list = useTenantApplicationsListTenantApplications(tenantId, {
    ...({} as any),
  });
  const subscribeMut = useTenantApplicationsSubscribeTenantApplication();
  const updateMut = useTenantApplicationsUpdateTenantApplication();
  const removeMut = useTenantApplicationsRemoveTenantApplication();

  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TenantApplication | null>(null);
  const [removeTarget, setRemoveTarget] = useState<TenantApplication | null>(null);

  const apps = (list.data?.data?.items ?? []) as TenantApplication[];

  // 应用名称解析：单键 clientId → clientName（2026-09-12 契约形状收敛后唯一寻址路径）。
  const clientsQ = useAdminClientsListClients();
  const clients = (clientsQ.data?.data?.items ?? []) as Array<{
    clientId?: string;
    clientName?: string;
  }>;
  const appNameBy = new Map<string, string>();
  for (const c of clients) {
    if (c.clientId) appNameBy.set(c.clientId, c.clientName ?? "—");
  }
  const appName = (clientId: string) => appNameBy.get(clientId) ?? "未知应用";

  async function onSubscribe(values: Record<string, unknown>) {
    try {
      await subscribeMut.mutateAsync({
        tenantId,
        data: {
          clientId: String(values.clientId ?? "").trim(),
          expireTime: values.expireTime ? String(values.expireTime) : undefined,
        } as SubscribeTenantApplicationRequest,
      });
      setSubscribeOpen(false);
      list.refetch();
      toast.success("应用已订阅");
    } catch (err) {
      toast.error(`订阅失败：${toApiError(err).message}`);
    }
  }

  async function onUpdate(values: Record<string, unknown>) {
    if (!editTarget) return;
    try {
      await updateMut.mutateAsync({
        tenantId,
        clientId: editTarget.clientId,
        data: {
          status: Number(values.status),
          expireTime: values.expireTime ? String(values.expireTime) : undefined,
        } as UpdateTenantApplicationRequest,
      });
      setEditTarget(null);
      list.refetch();
      toast.success("订阅已更新");
    } catch (err) {
      toast.error(`更新失败：${toApiError(err).message}`);
    }
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    try {
      await removeMut.mutateAsync({ tenantId, clientId: removeTarget.clientId });
      setRemoveTarget(null);
      list.refetch();
      toast.success("订阅已取消");
    } catch (err) {
      toast.error(`取消失败：${toApiError(err).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="租户应用"
        description={`${tenantLabel} 的应用订阅`}
        actions={
          <Button data-fn="M00.F05.I02" onClick={() => setSubscribeOpen(true)}>
            订阅应用
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>应用订阅列表 ({apps.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {list.isLoading ? (
            <LoadingState />
          ) : apps.length === 0 ? (
            <EmptyState
              title="还没有订阅应用"
              description="点击「订阅应用」为租户启用第一个业务应用"
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>应用名称</TableHead>
                  <TableHead>Client ID</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>到期时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id} data-testid="tenant-app-row">
                    <TableCell className="font-medium">{appName(a.clientId)}</TableCell>
                    <TableCell className="font-mono text-xs">{a.clientId}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs ${
                          a.status === 1
                            ? "bg-blue-50 text-blue-700"
                            : a.status === 0
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {statusLabel(a.status)}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {formatExpire(a.expireTime)}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        data-fn="M00.F05.I03"
                        onClick={() => setEditTarget(a)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-fn="M00.F05.I04"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setRemoveTarget(a)}
                      >
                        取消订阅
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CrudDialog
        open={subscribeOpen}
        onOpenChange={setSubscribeOpen}
        title="订阅应用"
        description="输入应用 Client ID 与（可选）到期时间。订阅后租户内的角色可分配菜单权限。"
        fields={SUBSCRIBE_FIELDS}
        submitText="创建"
        loading={subscribeMut.isPending}
        onSubmit={onSubscribe}
      />

      <CrudDialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => !o && setEditTarget(null)}
        title="编辑订阅"
        fields={UPDATE_FIELDS}
        initialValues={
          editTarget
            ? {
                status: String(editTarget.status),
                expireTime: editTarget.expireTime ?? "",
              }
            : undefined
        }
        loading={updateMut.isPending}
        onSubmit={onUpdate}
      />

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(o) => !o && setRemoveTarget(null)}
        title={`取消订阅「${removeTarget ? appName(removeTarget.clientId) : ""}」？`}
        description="租户下该应用的所有角色菜单授权将一并清除。不可撤销。"
        confirmText="取消订阅"
        destructive
        loading={removeMut.isPending}
        onConfirm={confirmRemove}
      />
    </div>
  );
}
