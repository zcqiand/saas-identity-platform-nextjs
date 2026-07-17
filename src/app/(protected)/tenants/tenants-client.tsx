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
import { Field } from "@/components/app/field";
import { ConfirmDialog } from "@/components/app/confirm-dialog";

/**
 * M01.F01 多租户切换 — 租户列表（client component）
 *
 * fn-ID 覆盖：
 *   - I01 页面根 → data-fn="M01.F01.I01"
 *   - I02 查询 → 搜索框 data-fn="M01.F01.I02"
 *   - I03 新增 → 顶部按钮 + Dialog 调 POST /api/tenants
 *   - I04 查看详情 → 行内 Link data-fn="M01.F01.I04"（跳 /tenants/[id]）
 *   - I05 删除 → 行内按钮调 fetch DELETE
 *   - I09 切换租户 → 顶部按钮 + Dialog 调 POST /api/tenants/switch
 */
interface TenantRow {
  id: number;
  code: string;
  name: string;
  theme: string;
  createdAt: string;
}

export interface TenantsClientProps {
  initialTenants: TenantRow[];
}

export function TenantsClient({ initialTenants }: TenantsClientProps) {
  const [tenants, setTenants] = useState<TenantRow[]>(initialTenants);
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);
  const [deleting, setDeleting] = useState<TenantRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = tenants.filter(
    (t) =>
      t.code.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleConfirmDelete() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/tenants/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `删除失败 (${res.status})`);
        return;
      }
      setTenants(tenants.filter((t) => t.id !== deleting.id));
      toast.success(`租户 ${deleting.code} 已删除`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="tenants-page"
      data-fn="M01.F01.I01"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>租户列表</CardTitle>
          <div className="space-x-2">
            <Button
              data-testid="switch-tenant-btn"
              data-fn="M01.F01.I09"
              variant="outline"
              size="sm"
              onClick={() => setSwitchOpen(true)}
            >
              切换租户
            </Button>
            <Button
              data-testid="new-tenant-btn"
              data-fn="M01.F01.I03"
              onClick={() => setCreateOpen(true)}
            >
              新增租户
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input
            data-testid="tenant-search"
            data-fn="M01.F01.I02"
            placeholder="搜索 code 或 name…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Theme</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id} data-testid="tenant-row">
                  <TableCell className="font-mono">{t.code}</TableCell>
                  <TableCell>{t.name}</TableCell>
                  <TableCell>{t.theme}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {t.createdAt}
                  </TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Link
                      href={`/tenants/${t.id}`}
                      data-testid="view-tenant-btn"
                      data-fn="M01.F01.I04"
                      className="border-input bg-background hover:bg-accent hover:text-accent-foreground inline-flex h-8 items-center justify-center rounded-md border px-3 text-sm font-medium"
                    >
                      查看
                    </Link>
                    <Button
                      data-testid="delete-tenant-btn"
                      data-fn="M01.F01.I05"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleting(t)}
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

      <NewTenantDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        submitting={submitting}
        setSubmitting={setSubmitting}
        onCreated={(t) => setTenants((prev) => [...prev, t])}
      />

      <SwitchTenantDialog
        open={switchOpen}
        onOpenChange={setSwitchOpen}
        tenants={tenants}
        submitting={submitting}
        setSubmitting={setSubmitting}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`确认删除租户「${deleting?.code ?? ""}」？`}
        confirmText="删除"
        destructive
        loading={submitting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 新增租户对话框                                                              */
/* -------------------------------------------------------------------------- */

interface NewTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCreated: (t: TenantRow) => void;
}

function NewTenantDialog({
  open,
  onOpenChange,
  submitting,
  setSubmitting,
  onCreated,
}: NewTenantDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [theme, setTheme] = useState("default");

  function reset() {
    setCode("");
    setName("");
    setTheme("default");
  }

  async function handleSubmit() {
    if (!code.trim() || !name.trim() || !theme.trim()) {
      toast.error("Code / 名称 / Theme 都必填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tenants", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          theme: theme.trim(),
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `创建失败 (${res.status})`);
        return;
      }
      const created = (await res.json()) as TenantRow;
      onCreated(created);
      toast.success(`租户 ${created.code} 已创建`);
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
      <DialogContent data-testid="new-tenant-dialog">
        <DialogHeader>
          <DialogTitle>新增租户</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Code" required htmlFor="new-tenant-code">
            <Input
              id="new-tenant-code"
              data-testid="new-tenant-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="如 hooli"
            />
          </Field>
          <Field label="名称" required htmlFor="new-tenant-name">
            <Input
              id="new-tenant-name"
              data-testid="new-tenant-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 Hooli"
            />
          </Field>
          <Field
            label="Theme"
            required
            htmlFor="new-tenant-theme"
            hint="default / dark / light"
          >
            <Input
              id="new-tenant-theme"
              data-testid="new-tenant-theme"
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
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
            data-testid="new-tenant-submit"
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
/* 切换租户对话框                                                              */
/* -------------------------------------------------------------------------- */

interface SwitchTenantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenants: TenantRow[];
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
}

function SwitchTenantDialog({
  open,
  onOpenChange,
  tenants,
  submitting,
  setSubmitting,
}: SwitchTenantDialogProps) {
  const [targetId, setTargetId] = useState<string>(
    () => String(tenants[0]?.id ?? ""),
  );

  async function handleSubmit() {
    const id = Number(targetId);
    if (!Number.isInteger(id) || id <= 0) {
      toast.error("请选择目标租户");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/tenants/switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tenantId: id }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `切换失败 (${res.status})`);
        return;
      }
      const t = tenants.find((x) => x.id === id);
      toast.success(`已切换到 ${t?.name ?? id}`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="switch-tenant-dialog">
        <DialogHeader>
          <DialogTitle>切换租户</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="目标租户" required htmlFor="switch-tenant-select">
            <select
              id="switch-tenant-select"
              data-testid="switch-tenant-select"
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.code})
                </option>
              ))}
            </select>
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
            data-testid="switch-tenant-submit"
            onClick={handleSubmit}
            disabled={submitting}
          >
            {submitting ? "切换中..." : "切换"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
