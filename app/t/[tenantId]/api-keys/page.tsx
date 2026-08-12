"use client";

import { use, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  useTenantApiKeysListApiKeys,
  useTenantApiKeysCreateApiKey,
  useTenantApiKeysRevokeApiKey,
  useTenantApiKeysRotateApiKey,
} from "@/api/endpoints/endpoints";
import type { ApiKey, CreateApiKeyRequest } from "@/api/endpoints/endpoints.schemas";
import { CrudDialog, type FieldDef } from "@/components/app/crud-dialog";
import { toApiError } from "@/api/http-client";

const KEY_STATUS_LABELS: Record<string, string> = {
  active: "启用",
  revoked: "已吊销",
};

const FIELDS: FieldDef[] = [
  { name: "name", label: "名称", required: true, placeholder: "Prod Key" },
];

export default function ApiKeyListPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const qc = useQueryClient();
  const list = useTenantApiKeysListApiKeys(tenantId);
  const createMut = useTenantApiKeysCreateApiKey();
  const revokeMut = useTenantApiKeysRevokeApiKey();
  const rotateMut = useTenantApiKeysRotateApiKey();

  const [createOpen, setCreateOpen] = useState(false);
  const keys = list.data?.data?.items ?? [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>API Key（M05.F01）— tenant {tenantId.slice(0, 8)}</h1>
        <button data-fn="M05.F01.I02" onClick={() => setCreateOpen(true)} style={{ padding: "6px 12px" }}>
          创建 Key
        </button>
      </div>
      <p data-testid="loading" hidden={!list.isLoading}>加载中…</p>
      <table data-testid="api-key-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>名称</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>前缀</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>状态</th>
            <th style={{ textAlign: "right", padding: 8, borderBottom: "1px solid #ddd" }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((k) => (
            <tr key={k.id} data-testid="api-key-row">
              <td style={{ padding: 8 }}>{k.name}</td>
              <td style={{ padding: 8, fontFamily: "monospace" }}>{k.prefix}</td>
              <td style={{ padding: 8 }}>{KEY_STATUS_LABELS[k.status]}</td>
              <td style={{ padding: 8, textAlign: "right" }}>
                <button
                  data-fn="M05.F01.I04"
                  onClick={async () => {
                    if (!confirm(`轮换 API Key「${k.name}」？旧 Key 将立即失效。`)) return;
                    try {
                      await rotateMut.mutateAsync({ tenantId, keyId: k.id });
                    } catch (err) {
                      alert(`轮换失败：${toApiError(err).message}`);
                    }
                  }}
                >
                  轮换
                </button>
                <button
                  data-fn="M05.F01.I03"
                  onClick={async () => {
                    if (!confirm(`吊销 API Key「${k.name}」？`)) return;
                    try {
                      await revokeMut.mutateAsync({ tenantId, keyId: k.id });
                    } catch (err) {
                      alert(`吊销失败：${toApiError(err).message}`);
                    }
                  }}
                  style={{ marginLeft: 8, color: "#c00" }}
                >
                  吊销
                </button>
              </td>
            </tr>
          ))}
          {keys.length === 0 && !list.isLoading && (
            <tr>
              <td colSpan={4} style={{ padding: 16, textAlign: "center", color: "#888" }} data-testid="empty">
                还没有 API Key
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <CrudDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="创建 API Key"
        fields={FIELDS}
        submitText="创建"
        loading={createMut.isPending}
        onSubmit={async (values) => {
          try {
            await createMut.mutateAsync({ tenantId, data: values as unknown as CreateApiKeyRequest });
            setCreateOpen(false);
          } catch (err) {
            alert(`创建失败：${toApiError(err).message}`);
          }
        }}
      />
    </div>
  );
}