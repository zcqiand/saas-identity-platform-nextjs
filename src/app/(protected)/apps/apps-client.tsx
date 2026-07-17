"use client";

import { useState } from "react";
import Link from "next/link";
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
 * M04.F01 应用管理（client）
 *
 * fn-ID 覆盖：
 *   - I01 应用列表页面 → data-testid="apps-page" data-fn="M04.F01.I01"
 *   - I02 搜索应用 → 搜索框 data-fn="M04.F01.I02"
 *   - I03 新建应用 → 顶部按钮 + NewAppDialog 调 POST /api/apps
 *   - I04 编辑应用 → 行内按钮 + EditAppDialog 调 PUT /api/apps/[id]
 *   - I05 删除应用 → 行内按钮 + ConfirmDialog 二次确认后 DELETE
 *   - I06 跳转菜单管理 → 行内 Link href=/apps/[id]/menus data-fn="M04.F01.I06"
 */
export interface AppRow extends Record<string, unknown> {
  id: number;
  code: string;
  name: string;
  type: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AppsClientProps {
  initialApps: AppRow[];
}

const ALL_TYPES = ["web", "mobile", "api", "spa"] as const;

export function AppsClient({ initialApps }: AppsClientProps) {
  const [apps, setApps] = useState<AppRow[]>(initialApps);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AppRow | null>(null);
  const [deleting, setDeleting] = useState<AppRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = apps.filter(
    (a) =>
      a.code.toLowerCase().includes(search.toLowerCase()) ||
      a.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleConfirmDelete() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/apps/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `删除失败 (${res.status})`);
        return;
      }
      setApps(apps.filter((a) => a.id !== deleting.id));
      toast.success(`应用 ${deleting.code} 已删除`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="apps-page"
      data-fn="M04.F01.I01"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>应用管理</CardTitle>
          <Button
            data-testid="new-app-btn"
            data-fn="M04.F01.I03"
            onClick={() => setCreateOpen(true)}
          >
            新建应用
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            data-testid="app-search"
            data-fn="M04.F01.I02"
            placeholder="搜索 code 或 name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => (
                <TableRow key={a.id} data-testid="app-row">
                  <TableCell className="font-mono">{a.code}</TableCell>
                  <TableCell>{a.name}</TableCell>
                  <TableCell>{a.type}</TableCell>
                  <TableCell>{a.enabled ? "✓" : "✗"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Link
                      href={`/apps/${a.id}/menus`}
                      data-testid="app-menus-btn"
                      data-fn="M04.F01.I06"
                      className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium"
                    >
                      菜单
                    </Link>
                    <Button
                      data-testid="edit-app-btn"
                      data-fn="M04.F01.I04"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(a)}
                    >
                      编辑
                    </Button>
                    <Button
                      data-testid="delete-app-btn"
                      data-fn="M04.F01.I05"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleting(a)}
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

      <NewAppDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        submitting={submitting}
        setSubmitting={setSubmitting}
        onCreated={(a) => setApps((prev) => [...prev, a])}
      />

      {editing ? (
        <EditAppDialog
          app={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onUpdated={(a) =>
            setApps((prev) => prev.map((x) => (x.id === a.id ? a : x)))
          }
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`确认删除应用「${deleting?.code ?? ""}」？`}
        description="应用下的菜单会随 CASCADE 一起删除。"
        confirmText="删除"
        destructive
        loading={submitting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 新建应用对话框                                                              */
/* -------------------------------------------------------------------------- */

interface NewAppDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCreated: (app: AppRow) => void;
}

function NewAppDialog({
  open,
  onOpenChange,
  submitting,
  setSubmitting,
  onCreated,
}: NewAppDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("web");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);

  function reset() {
    setCode("");
    setName("");
    setType("web");
    setDescription("");
    setEnabled(true);
  }

  async function handleSubmit() {
    if (!code.trim() || !name.trim()) {
      toast.error("Code 和名称必填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          type,
          description: description.trim() || undefined,
          enabled,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `创建失败 (${res.status})`);
        return;
      }
      const created = (await res.json()) as AppRow;
      onCreated(created);
      toast.success(`应用 ${created.code} 已创建`);
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
      <DialogContent data-testid="new-app-dialog">
        <DialogHeader>
          <DialogTitle>新建应用</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Code" required htmlFor="new-app-code">
            <Input
              id="new-app-code"
              data-testid="new-app-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="如 dashboard"
            />
          </Field>
          <Field label="名称" required htmlFor="new-app-name">
            <Input
              id="new-app-name"
              data-testid="new-app-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 数据看板"
            />
          </Field>
          <Field label="类型" htmlFor="new-app-type">
            <select
              id="new-app-type"
              data-testid="new-app-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="描述" htmlFor="new-app-description">
            <Input
              id="new-app-description"
              data-testid="new-app-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选"
            />
          </Field>
          <Field label="启用" htmlFor="new-app-enabled">
            <input
              id="new-app-enabled"
              data-testid="new-app-enabled"
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
            data-testid="new-app-submit"
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

/* -------------------------------------------------------------------------- */
/* 编辑应用对话框                                                              */
/* -------------------------------------------------------------------------- */

interface EditAppDialogProps {
  app: AppRow;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onUpdated: (app: AppRow) => void;
}

function EditAppDialog({
  app,
  onOpenChange,
  submitting,
  setSubmitting,
  onUpdated,
}: EditAppDialogProps) {
  const [name, setName] = useState(app.name);
  const [type, setType] = useState(app.type);
  const [description, setDescription] = useState(app.description ?? "");
  const [enabled, setEnabled] = useState(app.enabled);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("名称必填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/apps/${app.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type,
          description: description.trim() || undefined,
          enabled,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `保存失败 (${res.status})`);
        return;
      }
      const updated = (await res.json()) as AppRow;
      onUpdated(updated);
      toast.success(`应用 ${updated.code} 已更新`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent data-testid="edit-app-dialog">
        <DialogHeader>
          <DialogTitle>编辑应用</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Code" htmlFor="edit-app-code" hint="不可修改">
            <Input
              id="edit-app-code"
              data-testid="edit-app-code"
              value={app.code}
              disabled
              readOnly
            />
          </Field>
          <Field label="名称" required htmlFor="edit-app-name">
            <Input
              id="edit-app-name"
              data-testid="edit-app-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="类型" htmlFor="edit-app-type">
            <select
              id="edit-app-type"
              data-testid="edit-app-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              {ALL_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="描述" htmlFor="edit-app-description">
            <Input
              id="edit-app-description"
              data-testid="edit-app-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="启用" htmlFor="edit-app-enabled">
            <input
              id="edit-app-enabled"
              data-testid="edit-app-enabled"
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
            data-testid="edit-app-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}