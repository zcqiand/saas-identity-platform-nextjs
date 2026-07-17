"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Field } from "@/components/app/field";

/**
 * M04.F02 API Key 管理（client）
 *
 * fn-ID 覆盖：
 *   - I01 API Key 列表页面 → data-testid="api-keys-page" data-fn="M04.F02.I01"
 *   - I02 新建 API Key → 顶部按钮 + NewApiKeyDialog 调 POST /api/api-keys
 *   - I03 启用/禁用 → 行内按钮调 PATCH /api/api-keys/[id] 翻转 enabled
 *   - I04 删除 → 行内按钮 + ConfirmDialog 二次确认后 DELETE
 */
export interface ApiKeyRow extends Record<string, unknown> {
  id: number;
  name: string;
  key: string;
  appId: number;
  enabled: boolean;
  expiresAt: string;
  createdAt: string;
}

export interface ApiKeysClientProps {
  initialKeys: ApiKeyRow[];
  apps: Array<{ id: number; code: string; name: string }>;
}

export function ApiKeysClient({ initialKeys, apps }: ApiKeysClientProps) {
  const [keys, setKeys] = useState<ApiKeyRow[]>(initialKeys);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleting, setDeleting] = useState<ApiKeyRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/api-keys/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `删除失败 (${res.status})`);
        return;
      }
      setKeys(keys.filter((k) => k.id !== deleting.id));
      toast.success(`API Key ${deleting.name} 已删除`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggle(k: ApiKeyRow) {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/api-keys/${k.id}`, { method: "PATCH" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `切换失败 (${res.status})`);
        return;
      }
      const updated = (await res.json()) as ApiKeyRow;
      setKeys(keys.map((x) => (x.id === k.id ? updated : x)));
      toast.success(`API Key ${updated.name} 已${updated.enabled ? "启用" : "禁用"}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  function appLabel(id: number): string {
    const a = apps.find((x) => x.id === id);
    return a ? `${a.name} (${a.code})` : `#${id}`;
  }

  return (
    <div
      data-testid="api-keys-page"
      data-fn="M04.F02.I01"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>API Key 管理</CardTitle>
          <Button
            data-testid="new-api-key-btn"
            data-fn="M04.F02.I02"
            onClick={() => setCreateOpen(true)}
          >
            新建 API Key
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>Key</TableHead>
                <TableHead>应用</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {keys.map((k) => (
                <TableRow key={k.id} data-testid="api-key-row">
                  <TableCell className="font-medium">{k.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {k.key.slice(0, 8)}…
                  </TableCell>
                  <TableCell>{appLabel(k.appId)}</TableCell>
                  <TableCell>{k.enabled ? "✓" : "✗"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      data-testid="toggle-api-key-btn"
                      data-fn="M04.F02.I03"
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggle(k)}
                      disabled={submitting}
                    >
                      {k.enabled ? "禁用" : "启用"}
                    </Button>
                    <Button
                      data-testid="delete-api-key-btn"
                      data-fn="M04.F02.I04"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleting(k)}
                    >
                      删除
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <NewApiKeyDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        apps={apps}
        submitting={submitting}
        setSubmitting={setSubmitting}
        onCreated={(k) => setKeys((prev) => [...prev, k])}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`确认删除 API Key「${deleting?.name ?? ""}」？`}
        confirmText="删除"
        destructive
        loading={submitting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 新建 API Key 对话框                                                          */
/* -------------------------------------------------------------------------- */

interface NewApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apps: Array<{ id: number; code: string; name: string }>;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCreated: (k: ApiKeyRow) => void;
}

function NewApiKeyDialog({
  open,
  onOpenChange,
  apps,
  submitting,
  setSubmitting,
  onCreated,
}: NewApiKeyDialogProps) {
  const [name, setName] = useState("");
  const [appId, setAppId] = useState<string>(() =>
    apps[0] ? String(apps[0].id) : "",
  );
  const [enabled, setEnabled] = useState(true);

  function reset() {
    setName("");
    setAppId(apps[0] ? String(apps[0].id) : "");
    setEnabled(true);
  }

  async function handleSubmit() {
    const id = Number(appId);
    if (!name.trim() || !Number.isInteger(id) || id <= 0) {
      toast.error("名称 和 应用 都必填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/api-keys", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: name.trim(), appId: id, enabled }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `创建失败 (${res.status})`);
        return;
      }
      const created = (await res.json()) as ApiKeyRow;
      onCreated(created);
      toast.success(`API Key ${created.name} 已创建`);
      reset();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="new-api-key-dialog">
        <DialogHeader>
          <DialogTitle>新建 API Key</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="名称" required htmlFor="new-api-key-name">
            <Input
              id="new-api-key-name"
              data-testid="new-api-key-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 ci-deploy-key"
            />
          </Field>
          <Field label="应用" required htmlFor="new-api-key-app">
            <select
              id="new-api-key-app"
              data-testid="new-api-key-app"
              value={appId}
              onChange={(e) => setAppId(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              {apps.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.code})
                </option>
              ))}
            </select>
          </Field>
          <Field label="启用" htmlFor="new-api-key-enabled">
            <input
              id="new-api-key-enabled"
              data-testid="new-api-key-enabled"
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              className="size-4"
            />
          </Field>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            data-testid="new-api-key-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "提交中..." : "创建"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}