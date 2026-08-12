"use client";

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useAdminAppMenusListMenus,
  useAdminAppMenusCreateMenu,
  useAdminAppMenusUpdateMenu,
  useAdminAppMenusDeleteMenu,
} from "@/api/endpoints/endpoints";
import type { CreateMenuRequest, Menu, UpdateMenuRequest } from "@/api/endpoints/endpoints.schemas";
import { CrudDialog, type FieldDef } from "@/components/app/crud-dialog";
import { toApiError } from "@/api/http-client";

const MENU_TYPE_LABELS: Record<string, string> = {
  group: "分组",
  page: "页面",
  action: "操作",
};

const FIELDS: FieldDef[] = [
  { name: "code", label: "Code", required: true, placeholder: "users" },
  { name: "name", label: "名称", required: true, placeholder: "用户管理" },
  {
    name: "type",
    label: "类型",
    type: "select",
    required: true,
    defaultValue: "page",
    options: [
      { value: "group", label: "分组" },
      { value: "page", label: "页面" },
      { value: "action", label: "操作" },
    ],
  },
];

export default function MenuTreePage({ params }: { params: Promise<{ appId: string }> }) {
  const { appId } = use(params);
  const qc = useQueryClient();
  const list = useAdminAppMenusListMenus(appId);
  const createMut = useAdminAppMenusCreateMenu();
  const updateMut = useAdminAppMenusUpdateMenu();
  const deleteMut = useAdminAppMenusDeleteMenu();

  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Menu | null>(null);
  const menus = list.data?.data ?? [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>菜单管理（M08.F01）— app {appId.slice(0, 8)}</h1>
        <button data-fn="M08.F01.I02" onClick={() => setCreateOpen(true)} style={{ padding: "6px 12px" }}>
          新建菜单
        </button>
      </div>
      <p data-testid="loading" hidden={!list.isLoading}>加载中…</p>
      <ul data-testid="menu-tree" style={{ listStyle: "none", paddingLeft: 0 }}>
        {menus.map((m) => (
          <li
            key={m.id}
            data-testid={`menu-row-${m.id}`}
            style={{ padding: "4px 0" }}
          >
            <span data-fn="M08.F01.I01">
              {m.type === "group" ? "📁" : m.type === "action" ? "⚡" : "📄"} {m.name}
              <span style={{ color: "#888", fontSize: 12 }}>({MENU_TYPE_LABELS[m.type]})</span>
            </span>
            <button data-fn="M08.F01.I04" onClick={() => setEditTarget(m)} style={{ marginLeft: 8 }}>
              编辑
            </button>
            <button
              data-fn="M08.F01.I05"
              onClick={async () => {
                if (!confirm(`删除菜单「${m.name}」？`)) return;
                try {
                  await deleteMut.mutateAsync({ appId, menuId: m.id });
                } catch (err) {
                  alert(`删除失败：${toApiError(err).message}`);
                }
              }}
              style={{ marginLeft: 4, color: "#c00" }}
            >
              删除
            </button>
          </li>
        ))}
        {menus.length === 0 && !list.isLoading && (
          <li data-testid="empty" style={{ color: "#888", padding: 16 }}>还没有菜单</li>
        )}
      </ul>

      <CrudDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="新建菜单"
        fields={FIELDS}
        submitText="创建"
        loading={createMut.isPending}
        onSubmit={async (values) => {
          try {
            await createMut.mutateAsync({ appId, data: values as unknown as CreateMenuRequest });
            setCreateOpen(false);
          } catch (err) {
            alert(`创建失败：${toApiError(err).message}`);
          }
        }}
      />
      <CrudDialog
        open={Boolean(editTarget)}
        onOpenChange={(o) => !o && setEditTarget(null)}
        title="编辑菜单"
        fields={FIELDS}
        initialValues={
          editTarget
            ? { code: editTarget.code, name: editTarget.name, type: editTarget.type }
            : undefined
        }
        loading={updateMut.isPending}
        onSubmit={async (values) => {
          if (!editTarget) return;
          try {
            await updateMut.mutateAsync({
              appId,
              menuId: editTarget.id,
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