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
 * M03.F02 权限组管理（client）
 *
 * fn-ID 覆盖：
 *   - I01 权限组列表页 → data-fn="M03.F02.I01"
 *   - I02 新建权限组 → 顶部按钮 + NewPermGroupDialog 调 POST /api/permission-groups
 *   - I03 编辑权限组 → 行内按钮 + EditPermGroupDialog 调 PUT /api/permission-groups/[id]
 *   - I04 删除权限组 → 行内按钮 + ConfirmDialog 二次确认后 DELETE
 *   - I05 权限组 store 内部接口 → permission-group-store.ts (server-only，data-fn via @entry)
 */
export interface PermGroupRow extends Record<string, unknown> {
  id: number;
  name: string;
  description: string | null;
  permissions: string; // JSON string
  sort: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PermissionGroupsClientProps {
  initialGroups: PermGroupRow[];
}

function parsePerms(json: string): string[] {
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string");
  } catch {
    return [];
  }
}

export function PermissionGroupsClient({
  initialGroups,
}: PermissionGroupsClientProps) {
  const [groups, setGroups] = useState<PermGroupRow[]>(initialGroups);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PermGroupRow | null>(null);
  const [deleting, setDeleting] = useState<PermGroupRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/permission-groups/${deleting.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `删除失败 (${res.status})`);
        return;
      }
      setGroups(groups.filter((g) => g.id !== deleting.id));
      toast.success(`权限组 ${deleting.name} 已删除`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="permission-groups-page"
      data-fn="M03.F02.I01"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>权限组管理</CardTitle>
          <Button
            data-testid="new-perm-group-btn"
            data-fn="M03.F02.I02"
            onClick={() => setCreateOpen(true)}
          >
            新建权限组
          </Button>
        </CardHeader>
        <CardContent>
          <Table data-fn="M03.F02.I01">
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>权限码数</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id} data-testid="perm-group-row">
                  <TableCell className="font-mono">{g.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {g.description ?? "—"}
                  </TableCell>
                  <TableCell>{parsePerms(g.permissions).length}</TableCell>
                  <TableCell>{g.sort}</TableCell>
                  <TableCell>{g.enabled ? "✓" : "✗"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      data-testid="edit-perm-group-btn"
                      data-fn="M03.F02.I03"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(g)}
                    >
                      编辑
                    </Button>
                    <Button
                      data-testid="delete-perm-group-btn"
                      data-fn="M03.F02.I04"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleting(g)}
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

      <NewPermGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        submitting={submitting}
        setSubmitting={setSubmitting}
        onCreated={(g) => setGroups((prev) => [...prev, g])}
      />

      {editing ? (
        <EditPermGroupDialog
          group={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onUpdated={(g) =>
            setGroups((prev) => prev.map((x) => (x.id === g.id ? g : x)))
          }
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`确认删除权限组「${deleting?.name ?? ""}」？`}
        confirmText="删除"
        destructive
        loading={submitting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 新建权限组对话框                                                            */
/* -------------------------------------------------------------------------- */

interface NewPermGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCreated: (g: PermGroupRow) => void;
}

function NewPermGroupDialog({
  open,
  onOpenChange,
  submitting,
  setSubmitting,
  onCreated,
}: NewPermGroupDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [permissions, setPermissions] = useState("");
  const [sort, setSort] = useState("0");
  const [enabled, setEnabled] = useState(true);

  function reset() {
    setName("");
    setDescription("");
    setPermissions("");
    setSort("0");
    setEnabled(true);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("名称必填");
      return;
    }
    const perms = permissions
      .split(/[,\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const sortNum = Number(sort);
    setSubmitting(true);
    try {
      const res = await fetch("/api/permission-groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: perms,
          sort: Number.isFinite(sortNum) ? sortNum : 0,
          enabled,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `创建失败 (${res.status})`);
        return;
      }
      const created = (await res.json()) as PermGroupRow;
      onCreated(created);
      toast.success(`权限组 ${created.name} 已创建`);
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
      <DialogContent data-testid="new-perm-group-dialog">
        <DialogHeader>
          <DialogTitle>新建权限组</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="名称" required htmlFor="new-perm-group-name">
            <Input
              id="new-perm-group-name"
              data-testid="new-perm-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 admin-pack"
            />
          </Field>
          <Field label="描述" htmlFor="new-perm-group-description">
            <Input
              id="new-perm-group-description"
              data-testid="new-perm-group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选"
            />
          </Field>
          <Field
            label="权限码"
            htmlFor="new-perm-group-permissions"
            hint="逗号或空格分隔，如 user:read, role:write"
          >
            <Input
              id="new-perm-group-permissions"
              data-testid="new-perm-group-permissions"
              value={permissions}
              onChange={(e) => setPermissions(e.target.value)}
              placeholder="user:read, role:write"
              className="font-mono text-xs"
            />
          </Field>
          <Field label="排序" htmlFor="new-perm-group-sort">
            <Input
              id="new-perm-group-sort"
              data-testid="new-perm-group-sort"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </Field>
          <Field label="启用" htmlFor="new-perm-group-enabled">
            <input
              id="new-perm-group-enabled"
              data-testid="new-perm-group-enabled"
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
            data-testid="new-perm-group-submit"
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
/* 编辑权限组对话框                                                            */
/* -------------------------------------------------------------------------- */

interface EditPermGroupDialogProps {
  group: PermGroupRow;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onUpdated: (g: PermGroupRow) => void;
}

function EditPermGroupDialog({
  group,
  onOpenChange,
  submitting,
  setSubmitting,
  onUpdated,
}: EditPermGroupDialogProps) {
  const [description, setDescription] = useState(group.description ?? "");
  const [permissions, setPermissions] = useState(() =>
    parsePerms(group.permissions).join(", "),
  );
  const [sort, setSort] = useState(String(group.sort));
  const [enabled, setEnabled] = useState(group.enabled);

  async function handleSubmit() {
    const perms = permissions
      .split(/[,\s]+/)
      .map((p) => p.trim())
      .filter(Boolean);
    const sortNum = Number(sort);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/permission-groups/${group.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          description: description.trim() || undefined,
          permissions: perms,
          sort: Number.isFinite(sortNum) ? sortNum : 0,
          enabled,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `保存失败 (${res.status})`);
        return;
      }
      const updated = (await res.json()) as PermGroupRow;
      onUpdated(updated);
      toast.success(`权限组 ${updated.name} 已更新`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent data-testid="edit-perm-group-dialog">
        <DialogHeader>
          <DialogTitle>编辑权限组</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="名称" htmlFor="edit-perm-group-name" hint="不可修改">
            <Input
              id="edit-perm-group-name"
              data-testid="edit-perm-group-name"
              value={group.name}
              disabled
              readOnly
            />
          </Field>
          <Field label="描述" htmlFor="edit-perm-group-description">
            <Input
              id="edit-perm-group-description"
              data-testid="edit-perm-group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="权限码" htmlFor="edit-perm-group-permissions">
            <Input
              id="edit-perm-group-permissions"
              data-testid="edit-perm-group-permissions"
              value={permissions}
              onChange={(e) => setPermissions(e.target.value)}
              className="font-mono text-xs"
            />
          </Field>
          <Field label="排序" htmlFor="edit-perm-group-sort">
            <Input
              id="edit-perm-group-sort"
              data-testid="edit-perm-group-sort"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </Field>
          <Field label="启用" htmlFor="edit-perm-group-enabled">
            <input
              id="edit-perm-group-enabled"
              data-testid="edit-perm-group-enabled"
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
            data-testid="edit-perm-group-submit"
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