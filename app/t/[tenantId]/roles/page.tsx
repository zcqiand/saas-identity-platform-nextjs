"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useTenantRolesListRoles,
  useTenantRolesCreateRole,
  useTenantRolesUpdateRole,
  useTenantRolesDeleteRole,
} from "@/api/endpoints/endpoints";
import type { CreateRoleRequest, Role, UpdateRoleRequest } from "@/api/endpoints/endpoints.schemas";
import { CrudDialog, type FieldDef } from "@/components/app/crud-dialog";
import { toApiError } from "@/api/http-client";

const FIELDS: FieldDef[] = [
  { name: "code", label: "Code", required: true, placeholder: "admin" },
  { name: "name", label: "名称", required: true, placeholder: "管理员" },
];

export default function RoleListPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const qc = useQueryClient();
  const list = useTenantRolesListRoles(tenantId);
  const createMut = useTenantRolesCreateRole();
  const updateMut = useTenantRolesUpdateRole();
  const deleteMut = useTenantRolesDeleteRole();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Role | null>(null);
  const roles = list.data?.data?.items ?? [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>角色权限（M02.F01）— tenant {tenantId.slice(0, 8)}</h1>
        <button data-fn="M02.F01.I02" onClick={() => setCreateOpen(true)} style={{ padding: "6px 12px" }}>
          新建角色
        </button>
      </div>
      <p data-testid="loading" hidden={!list.isLoading}>加载中…</p>
      <table data-testid="role-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Code</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>名称</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>权限数</th>
            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #ddd" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((r) => (
            <tr key={r.id} data-testid="role-row">
              <td style={{ padding: 8, fontFamily: "monospace" }}>{r.code}</td>
              <td style={{ padding: 8 }}>{r.name}</td>
              <td style={{ padding: 8 }}>{r.permissionIds.length}</td>
              <td style={{ padding: 8, textAlign: "right" }}>
                <Link
                  href={`/t/${tenantId}/roles/${r.id}/menus`}
                  data-fn="M09.F02.I03"
                  style={{ marginRight: 8 }}
                >
                  授权
                </Link>
                <button data-fn="M02.F01.I04" onClick={() => setEditTarget(r)}>编辑</button>
                <button
                  data-fn="M02.F01.I05"
                  onClick={async () => {
                    if (!confirm(`删除角色「${r.name}」？`)) return;
                    try {
                      await deleteMut.mutateAsync({ tenantId, roleId: r.id });
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
          {roles.length === 0 && !list.isLoading && (
            <tr>
              <td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#888" }} data-testid="empty">
                还没有角色
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <CrudDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建角色"
        fields={FIELDS}
        submitText="创建"
        loading={createMut.isPending}
        onSubmit={async (values) => {
          try {
            await createMut.mutateAsync({ tenantId, data: values as unknown as CreateRoleRequest });
            setCreateOpen(false);
          } catch (err) {
            alert(`创建失败：${toApiError(err).message}`);
          }
        }}
      />
      <CrudDialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => !o && setEditTarget(null)}
        title="编辑角色"
        fields={FIELDS}
        initialValues={editTarget ? { code: editTarget.code, name: editTarget.name } : undefined}
        loading={updateMut.isPending}
        onSubmit={async (values) => {
          if (!editTarget) return;
          try {
            await updateMut.mutateAsync({
              tenantId,
              roleId: editTarget.id,
              data: { name: values.name as string },
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