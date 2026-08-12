"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { CrudDialog, type FieldDef } from "@/components/app/crud-dialog";
import { toApiError } from "@/api/http-client";

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

const STATUS_LABELS: Record<string, string> = {
  active: "启用",
  suspended: "暂停",
  archived: "归档",
};

export default function TenantListPage() {
  const qc = useQueryClient();
  const list = useQuery({
    queryKey: ["adminTenantsListTenants"],
    queryFn: async () => (await adminTenantsListTenants()).data.items,
  });

  const createMut = useMutation({
    mutationFn: (data: CreateTenantRequest) => adminTenantsCreateTenant(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminTenantsListTenants"] }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTenantRequest }) =>
      adminTenantsUpdateTenant(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminTenantsListTenants"] }),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => adminTenantsDeleteTenant(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adminTenantsListTenants"] }),
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Tenant | null>(null);
  const tenants = list.data ?? [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>租户管理（M00.F01）</h1>
        <button data-fn="M00.F01.I02" onClick={() => setCreateOpen(true)} style={{ padding: "6px 12px" }}>
          新建租户
        </button>
      </div>
      <p data-testid="loading" hidden={!list.isLoading}>加载中…</p>
      <table data-testid="tenant-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Code</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>名称</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>状态</th>
            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #ddd" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id} data-testid="tenant-row">
              <td style={{ padding: 8 }}>{t.code}</td>
              <td style={{ padding: 8 }}>{t.name}</td>
              <td style={{ padding: 8 }}>{STATUS_LABELS[t.status]}</td>
              <td style={{ padding: 8, textAlign: "right" }}>
                <button data-fn="M00.F01.I04" onClick={() => setEditTarget(t)}>
                  编辑
                </button>
                <button
                  data-fn="M00.F01.I05"
                  onClick={async () => {
                    if (!confirm(`删除租户「${t.name}」？操作不可撤销。`)) return;
                    try {
                      await deleteMut.mutateAsync(t.id);
                    } catch (err) {
                      alert(`删除失败：${toApiError(err).message}`);
                    }
                  }}
                  style={{ marginLeft: 8, color: "#c00" }}
                >
                  删除
                </button>
              </td>
            </tr>
          ))}
          {tenants.length === 0 && !list.isLoading && (
            <tr>
              <td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#888" }} data-testid="empty">
                还没有租户
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <CrudDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建租户"
        description="创建一个新的租户账号。Code 与名称不可重复。"
        fields={FIELDS}
        submitText="创建"
        loading={createMut.isPending}
        onSubmit={async (values) => {
          try {
            await createMut.mutateAsync(values as unknown as CreateTenantRequest);
            setCreateOpen(false);
          } catch (err) {
            alert(`创建失败：${toApiError(err).message}`);
          }
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
          try {
            await updateMut.mutateAsync({
              id: editTarget.id,
              data: {
                name: values.name as string,
                status: values.status as "active" | "suspended" | "archived",
              },
            });
            setEditTarget(null);
          } catch (err) {
            alert(`更新失败：${toApiError(err).message}`);
          }
        }}
      />
    </div>
  );
}