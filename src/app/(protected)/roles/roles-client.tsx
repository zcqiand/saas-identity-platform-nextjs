"use client";

import { useEffect, useState } from "react";
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

/** M03.F01 角色管理（client） */
export interface RoleRow extends Record<string, unknown> {
  id: number;
  code: string;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface RolesClientProps {
  initialRoles: RoleRow[];
}

export function RolesClient({ initialRoles }: RolesClientProps) {
  const [roles, setRoles] = useState<RoleRow[]>(initialRoles);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [deleting, setDeleting] = useState<RoleRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/roles/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `删除失败 (${res.status})`);
        return;
      }
      setRoles(roles.filter((r) => r.id !== deleting.id));
      toast.success(`角色 ${deleting.code} 已删除`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  const [permissionsFor, setPermissionsFor] = useState<RoleRow | null>(null);

  return (
    <div
      data-testid="roles-page"
      data-fn="M03.F01.I01"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>角色管理</CardTitle>
          <Button
            data-testid="new-role-btn"
            data-fn="M03.F01.I03"
            onClick={() => setCreateOpen(true)}
          >
            新建角色
          </Button>
        </CardHeader>
        <CardContent>
          <Table data-fn="M03.F01.I02">
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((r) => (
                <TableRow key={r.id} data-testid="role-row">
                  <TableCell className="font-mono">{r.code}</TableCell>
                  <TableCell>{r.name}</TableCell>
                  <TableCell>{r.enabled ? "✓" : "✗"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      data-testid="edit-role-btn"
                      data-fn="M03.F01.I04"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(r)}
                    >
                      编辑
                    </Button>
                    <Button
                      data-testid="role-permissions-btn"
                      data-fn="M03.F01.I07"
                      size="sm"
                      variant="secondary"
                      onClick={() => setPermissionsFor(r)}
                    >
                      权限
                    </Button>
                    <Button
                      data-testid="delete-role-btn"
                      data-fn="M03.F01.I05"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleting(r)}
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

      <NewRoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        submitting={submitting}
        setSubmitting={setSubmitting}
        onCreated={(r) => setRoles((prev) => [...prev, r])}
      />

      {editing ? (
        <EditRoleDialog
          role={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onUpdated={(r) =>
            setRoles((prev) => prev.map((x) => (x.id === r.id ? r : x)))
          }
        />
      ) : null}

      {permissionsFor ? (
        <RolePermissionsDialog
          role={permissionsFor}
          onOpenChange={(o) => !o && setPermissionsFor(null)}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`确认删除角色「${deleting?.code ?? ""}」？`}
        description="role_permissions 自动 CASCADE 清。"
        confirmText="删除"
        destructive
        loading={submitting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 新建角色对话框 — 抽出来方便单测                                            */
/* -------------------------------------------------------------------------- */

interface NewRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCreated: (role: RoleRow) => void;
}

function NewRoleDialog({
  open,
  onOpenChange,
  submitting,
  setSubmitting,
  onCreated,
}: NewRoleDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);

  function reset() {
    setCode("");
    setName("");
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
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          enabled,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `创建失败 (${res.status})`);
        return;
      }
      const created = (await res.json()) as RoleRow;
      onCreated(created);
      toast.success(`角色 ${created.code} 已创建`);
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
      <DialogContent data-testid="new-role-dialog">
        <DialogHeader>
          <DialogTitle>新建角色</DialogTitle>
        </DialogHeader>
        <div className="space-y-4" data-fn="M03.F01.I06">
          <Field label="Code" required htmlFor="new-role-code">
            <Input
              id="new-role-code"
              data-testid="new-role-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="如 editor"
            />
          </Field>
          <Field label="名称" required htmlFor="new-role-name">
            <Input
              id="new-role-name"
              data-testid="new-role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 Editor"
            />
          </Field>
          <Field label="描述" htmlFor="new-role-description">
            <Input
              id="new-role-description"
              data-testid="new-role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选"
            />
          </Field>
          <Field label="启用" htmlFor="new-role-enabled">
            <input
              id="new-role-enabled"
              data-testid="new-role-enabled"
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
            data-testid="new-role-submit"
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
/* 编辑角色对话框                                                             */
/* -------------------------------------------------------------------------- */

interface EditRoleDialogProps {
  role: RoleRow;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onUpdated: (role: RoleRow) => void;
}

function EditRoleDialog({
  role,
  onOpenChange,
  submitting,
  setSubmitting,
  onUpdated,
}: EditRoleDialogProps) {
  const [name, setName] = useState(role.name);
  const [description, setDescription] = useState(role.description ?? "");
  const [enabled, setEnabled] = useState(role.enabled);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("名称必填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/roles/${role.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          enabled,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `保存失败 (${res.status})`);
        return;
      }
      const updated = (await res.json()) as RoleRow;
      onUpdated(updated);
      toast.success(`角色 ${updated.code} 已更新`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent data-testid="edit-role-dialog" data-fn="M03.F01.I06">
        <DialogHeader>
          <DialogTitle>编辑角色</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Code" htmlFor="edit-role-code" hint="不可修改">
            <Input
              id="edit-role-code"
              data-testid="edit-role-code"
              value={role.code}
              disabled
              readOnly
            />
          </Field>
          <Field label="名称" required htmlFor="edit-role-name">
            <Input
              id="edit-role-name"
              data-testid="edit-role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="描述" htmlFor="edit-role-description">
            <Input
              id="edit-role-description"
              data-testid="edit-role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="启用" htmlFor="edit-role-enabled">
            <input
              id="edit-role-enabled"
              data-testid="edit-role-enabled"
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
            data-testid="edit-role-submit"
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

/* -------------------------------------------------------------------------- */
/* 角色权限绑定对话框 (M03.F01.I07)                                             */
/* -------------------------------------------------------------------------- */

interface RolePermissionsDialogProps {
  role: RoleRow;
  onOpenChange: (open: boolean) => void;
}

// D11 决策：权限码字符串（"user:read" 等），不在独立表。这里内置常用权限码。
const PRESET_PERMISSIONS = [
  "user:read",
  "user:write",
  "role:read",
  "role:write",
  "tenant:read",
  "tenant:write",
  "audit:read",
  "platform:admin",
];

function RolePermissionsDialog({ role, onOpenChange }: RolePermissionsDialogProps) {
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/roles/${role.id}/permissions`);
        if (res.ok) {
          const data = (await res.json()) as { permissions: string[] };
          if (!cancelled) setPerms(new Set(data.permissions));
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [role.id]);

  function toggle(p: string) {
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/roles/${role.id}/permissions`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ permissions: [...perms] }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `保存失败 (${res.status})`);
        return;
      }
      toast.success(`角色 ${role.code} 权限已更新`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent data-testid="role-permissions-dialog">
        <DialogHeader>
          <DialogTitle>角色「{role.code}」权限绑定</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-muted-foreground text-sm">加载中…</p>
        ) : (
          <div className="space-y-2">
            {PRESET_PERMISSIONS.map((p) => (
              <label key={p} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  data-testid={`role-permission-${p.replace(/[^a-z0-9]/gi, "-")}`}
                  checked={perms.has(p)}
                  onChange={() => toggle(p)}
                  className="size-4"
                />
                <code className="font-mono">{p}</code>
              </label>
            ))}
          </div>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            data-testid="role-permissions-submit"
            onClick={handleSubmit}
            disabled={submitting || loading}
          >
            {submitting ? "保存中..." : "保存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
