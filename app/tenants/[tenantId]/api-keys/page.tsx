"use client";

// M05.F01 — tenant-scoped API Key 生命周期（创建 / 吊销 / 轮换）

import { use, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useTenantApiKeysCreateApiKey,
  useTenantApiKeysListApiKeys,
  useTenantApiKeysRevokeApiKey,
  useTenantApiKeysRotateApiKey,
} from "@/api/endpoints/endpoints";
import type { ApiKey, CreateApiKeyRequest } from "@/api/endpoints/endpoints.schemas";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  { name: "name", label: "名称", required: true, placeholder: "Production Key" },
  { name: "scopesText", label: "Scopes（逗号分隔）", placeholder: "users.read, users.write" },
];

export default function ApiKeyListPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const qc = useQueryClient();
  const tenant = tenantId ? getTenant(tenantId) ?? null : null;
  const tenantLabel = tenant ? `租户 ${tenant.name}（${tenant.code}）` : "租户未知";

  const list = useTenantApiKeysListApiKeys(tenantId);
  const createMut = useTenantApiKeysCreateApiKey();
  const revokeMut = useTenantApiKeysRevokeApiKey();
  const rotateMut = useTenantApiKeysRotateApiKey();

  const [createOpen, setCreateOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [rotateTarget, setRotateTarget] = useState<ApiKey | null>(null);

  const keys = list.data?.data?.items ?? [];

  async function onCreate(values: Record<string, unknown>) {
    try {
      await createMut.mutateAsync({
        tenantId,
        data: {
          name: String(values.name ?? "").trim(),
          scopes: values.scopesText
            ? String(values.scopesText).split(",").map((s) => s.trim()).filter(Boolean)
            : [],
        } as CreateApiKeyRequest,
      });
      setCreateOpen(false);
      list.refetch();
      toast.success("API Key 已创建（请妥善保管 secret，仅展示一次）");
    } catch (err) {
      toast.error(`创建失败：${toApiError(err).message}`);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    try {
      await revokeMut.mutateAsync({ tenantId, keyId: revokeTarget.id });
      setRevokeTarget(null);
      list.refetch();
      toast.success("API Key 已吊销");
    } catch (err) {
      toast.error(`吊销失败：${toApiError(err).message}`);
    }
  }

  async function confirmRotate() {
    if (!rotateTarget) return;
    try {
      await rotateMut.mutateAsync({ tenantId, keyId: rotateTarget.id });
      setRotateTarget(null);
      list.refetch();
      toast.success("API Key 已轮换");
    } catch (err) {
      toast.error(`轮换失败：${toApiError(err).message}`);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="API Key"
        description={`${tenantLabel} 的 API 访问密钥`}
        actions={
          <Button data-fn="M05.F01.I02" onClick={() => setCreateOpen(true)}>
            创建 Key
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>Key 列表 ({keys.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          {list.isPending ? (
            <LoadingState />
          ) : keys.length === 0 ? (
            <EmptyState title="还没有 API Key" description="创建第一个 Key 以接入 API" />
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>前缀</TableHead>
                <TableHead>Scopes</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id}>
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell>
                    <code className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                      {k.prefix}…
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{k.scopes.length} 项</Badge>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={k.status as "active" | "revoked" | "expired"} />
                  </TableCell>
                  <TableCell className="text-right space-x-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      data-fn="M05.F01.I04"
                      disabled={k.status === "revoked"}
                      onClick={() => setRotateTarget(k)}
                    >
                      轮换
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-fn="M05.F01.I03"
                      className="text-red-600 hover:text-red-700"
                      disabled={k.status === "revoked"}
                      onClick={() => setRevokeTarget(k)}
                    >
                      吊销
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
        title="创建 API Key"
        description="Secret 仅在创建时返回一次，请妥善保存。"
        fields={FIELDS}
        submitText="创建"
        loading={createMut.isPending}
        onSubmit={onCreate}
      />

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        onOpenChange={(o) => !o && setRevokeTarget(null)}
        title={`吊销 API Key「${revokeTarget?.name ?? ""}？`}
        description="吊销后该 Key 立即失效，所有用此 Key 调用的请求将被拒绝。"
        confirmText="吊销"
        destructive
        loading={revokeMut.isPending}
        onConfirm={confirmRevoke}
      />

      <ConfirmDialog
        open={Boolean(rotateTarget)}
        onOpenChange={(o) => !o && setRotateTarget(null)}
        title={`轮换 API Key「${rotateTarget?.name ?? ""}？`}
        description="轮换将生成新 Key 并自动吊销旧 Key。Secret 仅在轮换时返回一次。"
        confirmText="轮换"
        loading={rotateMut.isPending}
        onConfirm={confirmRotate}
      />
    </div>
  );
}
