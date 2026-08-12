"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAdminAppsListApps,
  useAdminAppsCreateApp,
  useAdminAppsUpdateApp,
  useAdminAppsDeleteApp,
} from "@/api/endpoints/endpoints";
import type { App, CreateAppRequest, UpdateAppRequest } from "@/api/endpoints/endpoints.schemas";
import { CrudDialog, type FieldDef } from "@/components/app/crud-dialog";
import { toApiError } from "@/api/http-client";

const APP_STATUS_LABELS: Record<string, string> = {
  active: "启用",
  disabled: "停用",
};

const FIELDS: FieldDef[] = [
  { name: "code", label: "Code", required: true, placeholder: "lab-portal" },
  { name: "name", label: "名称", required: true, placeholder: "实验室门户" },
];

export default function AppListPage() {
  const qc = useQueryClient();
  const list = useAdminAppsListApps();
  const createMut = useAdminAppsCreateApp();
  const updateMut = useAdminAppsUpdateApp();
  const deleteMut = useAdminAppsDeleteApp();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<App | null>(null);
  const apps = list.data?.data?.items ?? [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>应用管理（M08.F01）</h1>
        <button data-fn="M08.F01.I02" onClick={() => setCreateOpen(true)} style={{ padding: "6px 12px" }}>
          注册应用
        </button>
      </div>
      <p data-testid="loading" hidden={!list.isLoading}>加载中…</p>
      <table data-testid="app-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>Code</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>名称</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>状态</th>
            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #ddd" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {apps.map((a) => (
            <tr key={a.id} data-testid="app-row">
              <td style={{ padding: 8, fontFamily: "monospace" }}>{a.code}</td>
              <td style={{ padding: 8 }}>{a.name}</td>
              <td style={{ padding: 8 }}>{APP_STATUS_LABELS[a.status]}</td>
              <td style={{ padding: 8, textAlign: "right" }}>
                <Link href={`/admin/apps/${a.id}/menus`} data-fn="M08.F01.I01" style={{ marginRight: 8 }}>
                  菜单
                </Link>
                <button data-fn="M08.F01.I04" onClick={() => setEditTarget(a)}>编辑</button>
                <button
                  data-fn="M08.F01.I05"
                  onClick={async () => {
                    if (!confirm(`删除应用「${a.name}」？`)) return;
                    try {
                      await deleteMut.mutateAsync({ appId: a.id });
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
          {apps.length === 0 && !list.isLoading && (
            <tr>
              <td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#888" }} data-testid="empty">
                还没有应用
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <CrudDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="注册应用"
        fields={FIELDS}
        submitText="注册"
        loading={createMut.isPending}
        onSubmit={async (values) => {
          try {
            await createMut.mutateAsync({ data: values as unknown as CreateAppRequest });
            setCreateOpen(false);
          } catch (err) {
            alert(`注册失败：${toApiError(err).message}`);
          }
        }}
      />
      <CrudDialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => !o && setEditTarget(null)}
        title="编辑应用"
        fields={FIELDS}
        initialValues={editTarget ? { code: editTarget.code, name: editTarget.name } : undefined}
        loading={updateMut.isPending}
        onSubmit={async (values) => {
          if (!editTarget) return;
          try {
            await updateMut.mutateAsync({
              appId: editTarget.id,
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