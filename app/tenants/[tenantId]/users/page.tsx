"use client";

// M01.F01 — tenant-scoped 用户列表（CRUD）

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useTenantRolesListRoles,
  useTenantUsersAssignRoles,
  useTenantUsersCreateUser,
  useTenantUsersDeleteUser,
  useTenantUsersListUsers,
  useTenantUsersUpdateUser,
} from "@/api/endpoints/endpoints";
import type {
  CreateUserRequest,
  UpdateUserRequest,
  User,
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
import { EmptyState } from "@/components/app/empty-state";
import { LoadingState } from "@/components/app/loading-state";
import { StatusBadge } from "@/components/app/status-badge";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { CrudDialog, type FieldDef } from "@/components/app/crud-dialog";
import { toApiError } from "@/api/http-client";
import { toast } from "sonner";
import { getTenant } from "@saas/identity-platform-msw";

const FIELDS: FieldDef[] = [
  { name: "username", label: "用户名", required: true, placeholder: "alice" },
  { name: "email", label: "邮箱", required: true, placeholder: "alice@acme.io" },
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

const EDIT_FIELDS = FIELDS.filter((f) => f.name !== "username");

export default function UserListPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const qc = useQueryClient();
  const tenant = tenantId ? getTenant(tenantId) ?? null : null;
  const tenantLabel = tenant ? `租户 ${tenant.name}（${tenant.code}）` : "租户未知";

  const usersQ = useTenantUsersListUsers(tenantId);
  const rolesQ = useTenantRolesListRoles(tenantId);
  const createMut = useTenantUsersCreateUser();
  const updateMut = useTenantUsersUpdateUser();
  const deleteMut = useTenantUsersDeleteUser();
  const roleAssignMut = useTenantUsersAssignRoles();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<User | null>(null);
  const [roleTarget, setRoleTarget] = useState<User | null>(null);

  const users = usersQ.data?.data?.items ?? [];
  const roles = rolesQ.data?.data?.items ?? [];

  async function onCreate(values: Record<string, unknown>) {
    try {
      await createMut.mutateAsync({
        tenantId,
        data: values as unknown as CreateUserRequest,
      });
      setCreateOpen(false);
      usersQ.refetch();
      toast.success("用户已创建");
    } catch (err) {
      toast.error(`创建失败：${toApiError(err).message}`);
    }
  }

  async function onUpdate(values: Record<string, unknown>) {
    if (!editTarget) return;
    try {
      await updateMut.mutateAsync({
        tenantId,
        userId: editTarget.id,
        data: {
          email: values.email as string,
          status: values.status as User["status"],
        } as UpdateUserRequest,
      });
      setEditTarget(null);
      usersQ.refetch();
      toast.success("用户已更新");
    } catch (err) {
      toast.error(`更新失败：${toApiError(err).message}`);
    }
  }

  async function onAssignRoles(values: Record<string, unknown>) {
    if (!roleTarget) return;
    const roleIds = Array.isArray(values.roleIds) ? (values.roleIds as string[]) : [];
    try {
      await roleAssignMut.mutateAsync({
        tenantId,
        userId: roleTarget.id,
        data: { roleIds },
      });
      setRoleTarget(null);
      usersQ.refetch();
      toast.success("角色已分配");
    } catch (err) {
      toast.error(`角色分配失败：${toApiError(err).message}`);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync({ tenantId, userId: deleteTarget.id });
      setDeleteTarget(null);
      usersQ.refetch();
      toast.success("用户已删除");
    } catch (err) {
      toast.error(`删除失败：${toApiError(err).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="用户管理"
        description={`${tenantLabel} 的所有用户`}
        actions={
          <Button data-fn="M01.F01.I02" onClick={() => setCreateOpen(true)}>
            邀请用户
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>用户列表 ({users.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {usersQ.isPending ? (
            <LoadingState />
          ) : users.length === 0 ? (
            <EmptyState title="还没有用户" description="邀请第一个用户加入租户" />
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>角色</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} data-testid="user-row">
                  <TableCell className="font-medium">{u.username}</TableCell>
                  <TableCell className="text-slate-500">{u.email}</TableCell>
                  <TableCell>
                    <StatusBadge status={u.status} />
                  </TableCell>
                  <TableCell>
                    <span className="text-xs text-slate-500">
                      {(u.roleIds ?? []).length} 项
                    </span>
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      data-fn="M01.F02.I01"
                      onClick={() => setRoleTarget(u)}
                    >
                      分配角色
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-fn="M01.F01.I04"
                      onClick={() => setEditTarget(u)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-fn="M01.F01.I05"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteTarget(u)}
                    >
                      删除
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
        title="邀请用户"
        description="向租户添加一个新用户。"
        fields={FIELDS}
        submitText="创建"
        loading={createMut.isPending}
        onSubmit={onCreate}
      />

      <CrudDialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => !o && setEditTarget(null)}
        title="编辑用户"
        fields={EDIT_FIELDS}
        initialValues={
          editTarget ? { email: editTarget.email, status: editTarget.status } : undefined
        }
        loading={updateMut.isPending}
        onSubmit={onUpdate}
      />

      <CrudDialog
        open={Boolean(roleTarget)}
        onOpenChange={(o) => !o && setRoleTarget(null)}
        title={`分配角色：${roleTarget?.username ?? ""}`}
        fields={[
          {
            name: "roleIds",
            label: "角色（多选）",
            type: "select",
            options: roles.map((r) => ({ value: r.id, label: `${r.code} · ${r.name}` })),
          },
        ]}
        submitText="保存角色"
        loading={roleAssignMut.isPending}
        initialValues={
          roleTarget ? { roleIds: roleTarget.roleIds ?? [] } : undefined
        }
        renderField={(_field, value, onChange) => (
          <div className="space-y-1 max-h-48 overflow-y-auto border rounded p-2">
            {roles.map((r) => {
              const checked = Array.isArray(value) && value.includes(r.id);
              return (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const next = new Set(Array.isArray(value) ? (value as string[]) : []);
                      if (e.target.checked) next.add(r.id);
                      else next.delete(r.id);
                      onChange(Array.from(next));
                    }}
                  />
                  <span className="font-mono text-xs">{r.code}</span>
                  <span>{r.name}</span>
                </label>
              );
            })}
          </div>
        )}
        onSubmit={onAssignRoles}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`删除用户「${deleteTarget?.username ?? ""}？`}
        description="用户删除后不可恢复，已分配的关联角色也会一并解除。"
        confirmText="删除"
        destructive
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />

      <p className="text-xs text-slate-400">
        <Link href="../roles" className="underline">
          角色权限 →
        </Link>
      </p>
    </div>
  );
}
