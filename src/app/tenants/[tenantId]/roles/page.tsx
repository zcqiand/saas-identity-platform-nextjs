"use client";

// M02.F01 — tenant-scoped 角色列表（CRUD + 菜单授权入口）

import { use, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
// 2026-09-11 E2E REQ-2026-005：barrel 死桩切真源 + 契约字段 code/name→roleCode/roleName
import { useAdminTenantsGetTenant } from "@/api/endpoints/admin-tenants/admin-tenants";
import {
  useTenantRolesCreateSysRole,
  useTenantRolesDeleteSysRole,
  useTenantRolesListSysRoles,
  useTenantRolesUpdateSysRole,
} from "@/api/endpoints/tenant-roles/tenant-roles";
import type {
  CreateSysRoleRequest,
  SysRole,
  UpdateSysRoleRequest,
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
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { CrudDialog, type FieldDef, type FieldValue } from "@/components/app/crud-dialog";
import { toApiError } from "@/api/http-client";
import { toast } from "sonner";

// PERMISSION_OPTIONS 已废止（role_permissions 表 DROP，M00.F04.I01 仅 springboot 仓实现）

const FIELDS: FieldDef[] = [
  { name: "roleCode", label: "Code", required: true, placeholder: "admin" },
  { name: "roleName", label: "名称", required: true, placeholder: "管理员" },
];

const EDIT_FIELDS = FIELDS.filter((f) => f.name !== "roleCode");

export default function RoleListPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const qc = useQueryClient();
  // getTenant via orval-generated useAdminTenantsGetTenant hook（ADR-0012 运行时 import 清零）。
  // 异步取租户名，加载中/失败显示 fallback。
  const tenantQ = useAdminTenantsGetTenant(tenantId, {
    query: { enabled: !!tenantId },
  });
  const tenant = tenantQ.data?.data ?? null;
  const tenantLabel = tenant ? `租户 ${tenant.name}（${tenant.tenantKey}）` : "租户未知";

  const list = useTenantRolesListSysRoles(tenantId, { clientId: "" } as never);
  const createMut = useTenantRolesCreateSysRole();
  const updateMut = useTenantRolesUpdateSysRole();
  const deleteMut = useTenantRolesDeleteSysRole();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<SysRole | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SysRole | null>(null);

  const roles = (list.data?.data?.items ?? []) as SysRole[];

  async function onCreate(values: Record<string, unknown>) {
    try {
      await createMut.mutateAsync({
        tenantId,
        data: { ...(values as unknown as CreateSysRoleRequest), clientId: "saas-console" },
      });
      setCreateOpen(false);
      list.refetch();
      toast.success("角色已创建");
    } catch (err) {
      toast.error(`创建失败：${toApiError(err).message}`);
    }
  }

  async function onUpdate(values: Record<string, unknown>) {
    if (!editTarget) return;
    try {
      await updateMut.mutateAsync({
        tenantId,
        roleId: editTarget.id,
        data: { roleName: values.roleName as string } as UpdateSysRoleRequest,
      });
      setEditTarget(null);
      list.refetch();
      toast.success("角色已更新");
    } catch (err) {
      toast.error(`更新失败：${toApiError(err).message}`);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMut.mutateAsync({ tenantId, roleId: deleteTarget.id });
      setDeleteTarget(null);
      list.refetch();
      toast.success("角色已删除");
    } catch (err) {
      toast.error(`删除失败：${toApiError(err).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="角色权限"
        description={`${tenantLabel} 的角色矩阵`}
        actions={
          <Button data-fn="M00.F03.I02" onClick={() => setCreateOpen(true)}>
            新建角色
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>角色列表 ({roles.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {list.isPending ? (
            <LoadingState />
          ) : roles.length === 0 ? (
            <EmptyState title="还没有角色" description="新建第一个角色以分配权限" />
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>名称</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id} data-testid="role-row">
                  <TableCell className="font-mono text-xs">{r.roleCode}</TableCell>
                  <TableCell className="font-medium">{r.roleName}</TableCell>
                  <TableCell className="text-right space-x-1">
                    {/* 权限矩阵按钮已废止（role_permissions 表 DROP，setPermissions endpoint 整体删） */}
                    <Button variant="ghost" size="sm" data-fn="M00.F04.I02" asChild>
                      <Link href={`/tenants/${tenantId}/roles/${r.id}/menus`}>菜单授权</Link>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-fn="M00.F03.I04"
                      onClick={() => setEditTarget(r)}
                    >
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-fn="M00.F03.I05"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => setDeleteTarget(r)}
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
        title="新建角色"
        fields={FIELDS}
        submitText="创建"
        loading={createMut.isPending}
        onSubmit={onCreate}
      />

      <CrudDialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => !o && setEditTarget(null)}
        title="编辑角色"
        fields={EDIT_FIELDS}
        initialValues={editTarget ? { roleName: editTarget.roleName } : undefined}
        loading={updateMut.isPending}
        onSubmit={onUpdate}
      />

      {/* M00.F04.I01 权限矩阵：role_permissions 表已废止，对话框整体删。springboot 仓实现仍提供 setPermissions endpoint。 */}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`删除角色「${deleteTarget?.roleName ?? ""}？`}
        description="角色删除将一并解除角色与用户的绑定关系。"
        confirmText="删除"
        destructive
        loading={deleteMut.isPending}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
