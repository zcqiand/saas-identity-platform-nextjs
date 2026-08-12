"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useTenantUsersListUsers,
  useTenantUsersCreateUser,
  useTenantUsersUpdateUser,
  useTenantUsersDeleteUser,
} from "@/api/endpoints/endpoints";
import type {
  CreateUserRequest,
  User,
  UpdateUserRequest,
} from "@/api/endpoints/endpoints.schemas";
import { CrudDialog, type FieldDef } from "@/components/app/crud-dialog";
import { toApiError } from "@/api/http-client";

const USER_STATUS_LABELS: Record<string, string> = {
  active: "启用",
  invited: "已邀请",
  suspended: "暂停",
  disabled: "停用",
};

const FIELDS: FieldDef[] = [
  { name: "username", label: "用户名", required: true },
  { name: "email", label: "邮箱", placeholder: "user@example.com" },
  {
    name: "status",
    label: "状态",
    type: "select",
    required: true,
    defaultValue: "invited",
    options: [
      { value: "active", label: "启用" },
      { value: "invited", label: "已邀请" },
      { value: "suspended", label: "暂停" },
      { value: "disabled", label: "停用" },
    ],
  },
];

export default function UserListPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const qc = useQueryClient();
  const list = useTenantUsersListUsers(tenantId);
  const createMut = useTenantUsersCreateUser();
  const updateMut = useTenantUsersUpdateUser();
  const deleteMut = useTenantUsersDeleteUser();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const users = list.data?.data?.items ?? [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>用户管理（M01.F01）— tenant {tenantId.slice(0, 8)}</h1>
        <button data-fn="M01.F01.I02" onClick={() => setCreateOpen(true)} style={{ padding: "6px 12px" }}>
          新建用户
        </button>
      </div>
      <p data-testid="loading" hidden={!list.isLoading}>加载中…</p>
      <table data-testid="user-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>用户名</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>邮箱</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>状态</th>
            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #ddd" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id} data-testid="user-row">
              <td style={{ padding: 8 }}>{u.username}</td>
              <td style={{ padding: 8 }}>{u.email ?? "—"}</td>
              <td style={{ padding: 8 }}>{USER_STATUS_LABELS[u.status]}</td>
              <td style={{ padding: 8, textAlign: "right" }}>
                <button data-fn="M01.F01.I04" onClick={() => setEditTarget(u)}>编辑</button>
                <button
                  data-fn="M01.F01.I05"
                  onClick={async () => {
                    if (!confirm(`删除用户「${u.username}」？`)) return;
                    try {
                      await deleteMut.mutateAsync({ tenantId, userId: u.id });
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
          {users.length === 0 && !list.isLoading && (
            <tr>
              <td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#888" }} data-testid="empty">
                还没有用户
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <CrudDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建用户"
        fields={FIELDS}
        submitText="创建"
        loading={createMut.isPending}
        onSubmit={async (values) => {
          try {
            await createMut.mutateAsync({ tenantId, data: values as unknown as CreateUserRequest });
            setCreateOpen(false);
          } catch (err) {
            alert(`创建失败：${toApiError(err).message}`);
          }
        }}
      />
      <CrudDialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => !o && setEditTarget(null)}
        title="编辑用户"
        fields={FIELDS}
        initialValues={
          editTarget
            ? { username: editTarget.username, email: editTarget.email ?? "", status: editTarget.status }
            : undefined
        }
        loading={updateMut.isPending}
        onSubmit={async (values) => {
          if (!editTarget) return;
          try {
            await updateMut.mutateAsync({
              tenantId,
              userId: editTarget.id,
              data: { email: values.email as string, status: values.status as "active" | "invited" | "suspended" | "disabled" },
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