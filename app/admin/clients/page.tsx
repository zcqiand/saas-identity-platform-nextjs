"use client";

// M04 — 平台级应用管理（CRUD + 启用/停用；同时承担 OAuth client 职责）
// 数据源直连真源 tag 模块 admin-clients（此前 import legacy 死桩 → 列表恒空）。
// 契约 OAuthClient（clientName/scopes:string）与 msw App fixture（name/scopes:[]）
// 字段有漂移，行渲染做双路兜底。

import { useState } from "react";
import Link from "next/link";
import {
  useAdminClientsCreateClient,
  useAdminClientsDeleteClient,
  useAdminClientsListClients,
  useAdminClientsSetClientStatus,
  useAdminClientsUpdateClient,
} from "@/api/endpoints/admin-clients/admin-clients";
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
import { StatusBadge } from "@/components/app/status-badge";
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { CrudDialog, type FieldDef } from "@/components/app/crud-dialog";
import { toApiError } from "@/api/http-client";
import { toast } from "sonner";

/** 展示行：契约 OAuthClient 与 msw App fixture 的字段并集（全可选兜底）。 */
interface AppRow {
  id: string;
  code?: string;
  name?: string;
  clientName?: string;
  clientId?: string;
  icon?: string;
  scopes?: string[] | string;
  isFirstParty?: boolean;
  sortOrder?: number;
  status?: string;
}

const FIELDS: FieldDef[] = [
  { name: "code", label: "Code", required: true, placeholder: "lab-management" },
  {
    name: "name",
    label: "名称",
    required: true,
    placeholder: "建筑工程实验室管理系统",
  },
  { name: "clientId", label: "Client ID", required: true, placeholder: "lab-mgmt" },
  { name: "icon", label: "图标（lucide 名称）", placeholder: "FlaskConical" },
  { name: "sortOrder", label: "排序", type: "number", defaultValue: 0 },
  {
    name: "isFirstParty",
    label: "一方应用",
    type: "checkbox",
    defaultValue: true,
    hint: "一方应用对租户可见",
  },
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    defaultValue: "active",
    options: [
      { value: "active", label: "启用" },
      { value: "disabled", label: "停用" },
    ],
  },
  { name: "scopesText", label: "Scopes（逗号分隔）", placeholder: "lab.read, lab.write" },
];

const EDIT_FIELDS = FIELDS.filter((f) => f.name !== "code" && f.name !== "clientId");

const rowName = (a: AppRow) => a.name ?? a.clientName ?? "—";
const rowScopes = (a: AppRow): string[] =>
  Array.isArray(a.scopes) ? a.scopes : a.scopes ? String(a.scopes).split(",").filter(Boolean) : [];

function toClientInput(values: Record<string, unknown>): Record<string, unknown> {
  const name = String(values.name ?? "").trim();
  return {
    // msw App fixture 扩展字段
    code: String(values.code ?? "").trim(),
    name,
    icon: values.icon ? String(values.icon) : undefined,
    sortOrder: Number(values.sortOrder ?? 0),
    status: (values.status as "active" | "disabled") ?? "active",
    isFirstParty: Boolean(values.isFirstParty),
    // 契约 CreateOAuthClientRequest 必填：clientId/clientName/clientSecret/grantTypes/redirectUris
    clientId: String(values.clientId ?? "").trim(),
    clientName: name,
    clientSecret: `sec-${Math.random().toString(36).slice(2, 14)}`,
    grantTypes: "authorization_code,client_credentials",
    redirectUris: "",
    scopes: values.scopesText
      ? String(values.scopesText)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
          .join(",")
      : "",
  };
}

export default function AppListPage() {
  const list = useAdminClientsListClients();
  const createMut = useAdminClientsCreateClient();
  const updateMut = useAdminClientsUpdateClient();
  const deleteMut = useAdminClientsDeleteClient();
  const statusMut = useAdminClientsSetClientStatus();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AppRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppRow | null>(null);

  const apps = (list.data?.data?.items ?? []) as unknown as AppRow[];

  async function onCreate(values: Record<string, unknown>) {
    try {
      await createMut.mutateAsync({
        data: toClientInput(values) as never,
      });
      setCreateOpen(false);
      list.refetch();
      toast.success("应用已创建");
    } catch (err) {
      toast.error(`创建失败：${toApiError(err).message}`);
    }
  }

  async function onUpdate(values: Record<string, unknown>) {
    if (!editTarget) return;
    try {
      await updateMut.mutateAsync({
        clientId: editTarget.id,
        data: {
          clientName: values.name as string,
          name: values.name as string,
          icon: (values.icon as string) || undefined,
          sortOrder: Number(values.sortOrder ?? 0),
          status: values.status as "active" | "disabled",
          isFirstParty: Boolean(values.isFirstParty),
          scopes: values.scopesText
            ? String(values.scopesText)
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .join(",")
            : "",
        } as never,
      });
      setEditTarget(null);
      list.refetch();
      toast.success("应用已更新");
    } catch (err) {
      toast.error(`更新失败：${toApiError(err).message}`);
    }
  }

  async function toggleStatus(a: AppRow) {
    try {
      await statusMut.mutateAsync({
        clientId: a.id,
        data: { status: a.status === "active" ? "disabled" : "active" },
      } as never);
      list.refetch();
      toast.success("状态已切换");
    } catch (err) {
      toast.error(`状态切换失败：${toApiError(err).message}`);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync({ clientId: deleteTarget.id });
      setDeleteTarget(null);
      list.refetch();
      toast.success("应用已删除");
    } catch (err) {
      toast.error(`删除失败：${toApiError(err).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="应用管理"
        description="平台级业务应用（同时承载 OAuth client）。每个应用有菜单树，租户通过订阅获得应用，再在租户内部分发菜单给角色。"
        actions={
          <Button data-fn="M04.F04.I02" onClick={() => setCreateOpen(true)}>
            新建应用
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>应用列表 ({apps.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {list.isPending ? (
            <LoadingState />
          ) : apps.length === 0 ? (
            <EmptyState title="还没有应用" description="创建第一个应用以承载菜单" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code / ClientID</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {apps.map((a) => (
                  <TableRow key={a.id} data-testid="app-row">
                    <TableCell>
                      <div className="font-mono text-xs">{a.code ?? "—"}</div>
                      <div className="font-mono text-[10px] text-slate-500">
                        clientId: {a.clientId ?? a.id}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{rowName(a)}</TableCell>
                    <TableCell>
                      <StatusBadge status={a.status === "active" ? "active" : "suspended"} />
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        data-fn="M04.F02.I01"
                        onClick={() => toggleStatus(a)}
                      >
                        {a.status === "active" ? "停用" : "启用"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-fn="M04.F04.I04"
                        onClick={() => setEditTarget(a)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        data-fn="M04.F04.I05"
                        className="text-red-600 hover:text-red-700"
                        onClick={() => setDeleteTarget(a)}
                      >
                        删除
                      </Button>
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/admin/clients/${a.code ?? a.id}/menus`}>菜单</Link>
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
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建应用"
        description="应用同时也是 OAuth client；创建后会自动绑定到菜单树。"
        fields={FIELDS}
        submitText="创建"
        loading={createMut.isPending}
        onSubmit={onCreate}
      />

      <CrudDialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => !o && setEditTarget(null)}
        title="编辑应用"
        fields={EDIT_FIELDS}
        initialValues={
          editTarget
            ? {
                name: rowName(editTarget),
                icon: editTarget.icon,
                sortOrder: editTarget.sortOrder,
                isFirstParty: editTarget.isFirstParty,
                status: editTarget.status,
                scopesText: rowScopes(editTarget).join(", "),
              }
            : undefined
        }
        loading={updateMut.isPending}
        onSubmit={onUpdate}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`删除应用「${deleteTarget ? rowName(deleteTarget) : ""}」？`}
        description="应用删除将一并删除其下所有菜单。不可撤销。"
        confirmText="删除"
        destructive
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
