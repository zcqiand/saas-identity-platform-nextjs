"use client";

import { use, useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  useAdminAppsListApps,
  useAdminAppMenusListMenus,
  useTenantRoleMenusListRoleMenus,
  useTenantRoleMenusSetRoleMenus,
} from "@/api/endpoints/endpoints";
import type { App, Menu } from "@/api/endpoints/endpoints.schemas";
import { toApiError } from "@/api/http-client";

export default function RoleMenuGrantPage({
  params,
}: {
  params: Promise<{ tenantId: string; roleId: string }>;
}) {
  const { tenantId, roleId } = use(params);
  const apps = useAdminAppsListApps();
  const roleMenus = useTenantRoleMenusListRoleMenus(tenantId, roleId);
  const setRoleMenus = useTenantRoleMenusSetRoleMenus();

  const [grantedMenuIds, setGrantedMenuIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const ids = roleMenus.data?.data?.menuIds ?? [];
    setGrantedMenuIds(new Set(ids));
  }, [roleMenus.data]);

  const [saving, setSaving] = useState(false);
  const appList: App[] = apps.data?.data?.items ?? [];
  const firstAppId = appList[0]?.id ?? "";
  const menus = useAdminAppMenusListMenus(firstAppId);
  const menuList: Menu[] = menus.data?.data ?? [];

  function toggle(menuId: string, checked: boolean) {
    setGrantedMenuIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(menuId);
      else next.delete(menuId);
      return next;
    });
  }

  async function save() {
    setSaving(true);
    try {
      await setRoleMenus.mutateAsync({
        tenantId,
        roleId,
        data: { menuIds: Array.from(grantedMenuIds) },
      });
      alert("授权已保存");
    } catch (err) {
      alert(`保存失败：${toApiError(err).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h1 style={{ marginTop: 0 }}>
        角色授权（M09.F02）— role {roleId.slice(0, 8)} · tenant {tenantId.slice(0, 8)}
      </h1>
      <p data-testid="loading" hidden={!roleMenus.isLoading && !apps.isLoading}>加载中…</p>
      <div>
        {appList.map((app) => (
          <div
            key={app.id}
            style={{ marginBottom: 16, padding: 12, border: "1px solid #eee", borderRadius: 4 }}
          >
            <div style={{ fontWeight: 600, marginBottom: 8 }}>{app.name}</div>
            {menuList.map((m) => (
              <label
                key={m.id}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, marginRight: 16 }}
              >
                <input
                  type="checkbox"
                  checked={grantedMenuIds.has(m.id)}
                  data-fn="M09.F02.I03"
                  onChange={(e) => toggle(m.id, e.target.checked)}
                />
                <span>
                  {m.name} <span style={{ color: "#888", fontSize: 12 }}>({m.code})</span>
                </span>
              </label>
            ))}
            {menuList.length === 0 && (
              <p style={{ color: "#888", fontSize: 12 }}>该应用还没有菜单</p>
            )}
          </div>
        ))}
      </div>
      <button
        data-fn="M09.F02.I02"
        onClick={save}
        disabled={saving}
        style={{
          padding: "8px 16px",
          background: "#1f2937",
          color: "#fff",
          border: 0,
          borderRadius: 4,
        }}
      >
        {saving ? "保存中…" : "保存授权"}
      </button>
    </div>
  );
}