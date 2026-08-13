"use client";

// M00.F01 — 平台级租户管理（CRUD）

import { useState } from "react";
import { Check } from "lucide-react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  adminTenantsCreateTenant,
  adminTenantsDeleteTenant,
  adminTenantsListTenants,
  adminTenantsUpdateTenant,
} from "@/api/endpoints/endpoints";
import type {
  CreateTenantRequest,
  Tenant,
  UpdateTenantRequest,
} from "@/api/endpoints/endpoints.schemas";
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
import { useSelection } from "@/state/selection-context";
import { toApiError } from "@/api/http-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const FIELDS: FieldDef[] = [
  { name: "code", label: "Code", required: true, placeholder: "acme" },
  { name: "name", label: "名称", required: true, placeholder: "ACME Corp" },
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    defaultValue: "active",
    options: [
      { value: "active", label: "启用" },
      { value: "suspended", label: "暂停" },
      { value: "archived", label: "归档" },
    ],
  },
];

export default function TenantListPage() {
  const { selectedTenant, setSelectedTenant } = useSelection();
  const qc = useQueryClient();

  const list = useQuery({
    queryKey: ["adminTenantsListTenants"],
    queryFn: async () => (await adminTenantsListTenants()).data.items,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateTenantRequest) => adminTenantsCreateTenant(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminTenantsListTenants"] });
      toast.success("租户已创建");
    },
    onError: (err) => toast.error(`创建失败：${toApiError(err).message}`),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTenantRequest }) =>
      adminTenantsUpdateTenant(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminTenantsListTenants"] });
      toast.success("租户已更新");
    },
    onError: (err) => toast.error(`更新失败：${toApiError(err).message}`),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminTenantsDeleteTenant(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["adminTenantsListTenants"] });
      toast.success("租户已删除");
    },
    onError: (err) => toast.error(`删除失败：${toApiError(err).message}`),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tenant | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Tenant | null>(null);

  const tenants = list.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="租户管理"
        description={
          <>
            管理 SaaS 平台上的所有租户账号
            {selectedTenant && (
              <span className="ml-3 text-slate-500 text-xs">
                · 已选中{" "}
                <span className="font-medium text-slate-700">{selectedTenant.name}</span>
                <code className="ml-1 font-mono">({selectedTenant.id.slice(0, 8)})</code>
              </span>
            )}
          </>
        }
        actions={
          <Button data-fn="M00.F01.I02" onClick={() => setCreateOpen(true)}>
            新建租户
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>租户列表 ({tenants.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {list.isPending ? (
            <LoadingState />
          ) : tenants.length === 0 ? (
            <EmptyState title="还没有租户" description="创建第一个租户开始使用" />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((t) => {
                  const isSelected = t.id === selectedTenant.id;
                  return (
                    <TableRow
                      key={t.id}
                      data-testid="tenant-row"
                      data-selected={isSelected ? "true" : "false"}
                      onClick={() => setSelectedTenant({ id: t.id, name: t.name })}
                      className={cn(
                        "cursor-pointer transition-colors",
                        isSelected && "bg-blue-50 hover:bg-blue-100",
                      )}
                    >
                      <TableCell>
                        {isSelected && (
                          <Check className="h-4 w-4 text-blue-600" data-testid="tenant-selected-mark" />
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{t.code}</TableCell>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>
                        <StatusBadge status={t.status as "active" | "suspended" | "archived"} />
                      </TableCell>
                      <TableCell className="text-right space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          data-fn="M00.F01.I04"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditTarget(t);
                          }}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          data-fn="M00.F01.I05"
                          className="text-red-600 hover:text-red-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(t);
                          }}
                        >
                          删除
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <CrudDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建租户"
        description="创建一个新的租户账号。Code 与名称不可重复。"
        fields={FIELDS}
        submitText="创建"
        loading={createMut.isPending}
        onSubmit={async (values) => {
          await createMut.mutateAsync(values as unknown as CreateTenantRequest);
          setCreateOpen(false);
        }}
      />

      <CrudDialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => !o && setEditTarget(null)}
        title="编辑租户"
        fields={FIELDS}
        initialValues={
          editTarget
            ? { code: editTarget.code, name: editTarget.name, status: editTarget.status }
            : undefined
        }
        loading={updateMut.isPending}
        onSubmit={async (values) => {
          if (!editTarget) return;
          await updateMut.mutateAsync({
            id: editTarget.id,
            data: {
              name: values.name as string,
              status: values.status as "active" | "suspended" | "archived",
            },
          });
          setEditTarget(null);
        }}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`删除租户「${deleteTarget?.name ?? ""}？`}
        description="删除后该租户下的用户、角色、API Key 数据将无法访问。操作不可撤销。"
        confirmText="删除"
        destructive
        loading={deleteMut.isPending}
        onConfirm={async () => {
          if (!deleteTarget) return;
          await deleteMut.mutateAsync(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </div>
  );
}
