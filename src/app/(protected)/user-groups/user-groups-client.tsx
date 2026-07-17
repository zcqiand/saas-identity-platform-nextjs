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
 * M03.F03 用户组管理（client）
 *
 * fn-ID 覆盖：
 *   - I01 页面根 → data-fn="M03.F03.I01"
 *   - I02 新建用户组 → 顶部按钮 + NewGroupDialog 调 POST /api/user-groups
 *   - I03 编辑用户组 → 行内按钮 + EditGroupDialog 调 PUT /api/user-groups/[id]
 *   - I04 删除用户组 → 行内按钮 + ConfirmDialog 二次确认后 DELETE
 */
export interface GroupRow extends Record<string, unknown> {
  id: number;
  name: string;
  description: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserGroupsClientProps {
  initialGroups: GroupRow[];
}

export function UserGroupsClient({ initialGroups }: UserGroupsClientProps) {
  const [groups, setGroups] = useState<GroupRow[]>(initialGroups);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<GroupRow | null>(null);
  const [deleting, setDeleting] = useState<GroupRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/user-groups/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `删除失败 (${res.status})`);
        return;
      }
      setGroups(groups.filter((g) => g.id !== deleting.id));
      toast.success(`用户组 ${deleting.name} 已删除`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="user-groups-page"
      data-fn="M03.F03.I01"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>用户组管理</CardTitle>
          <Button
            data-testid="new-group-btn"
            data-fn="M03.F03.I02"
            onClick={() => setCreateOpen(true)}
          >
            新建用户组
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.map((g) => (
                <TableRow key={g.id} data-testid="group-row">
                  <TableCell className="font-medium">{g.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {g.description ?? "—"}
                  </TableCell>
                  <TableCell>{g.enabled ? "✓" : "✗"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      data-testid="edit-group-btn"
                      data-fn="M03.F03.I03"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(g)}
                    >
                      编辑
                    </Button>
                    <Button
                      data-testid="delete-group-btn"
                      data-fn="M03.F03.I04"
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

      <NewGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        submitting={submitting}
        setSubmitting={setSubmitting}
        onCreated={(g) => setGroups((prev) => [...prev, g])}
      />

      {editing ? (
        <EditGroupDialog
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
        title={`确认删除用户组「${deleting?.name ?? ""}」？`}
        description="members 自动 CASCADE 清。"
        confirmText="删除"
        destructive
        loading={submitting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 新建用户组对话框                                                            */
/* -------------------------------------------------------------------------- */

interface NewGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCreated: (group: GroupRow) => void;
}

function NewGroupDialog({
  open,
  onOpenChange,
  submitting,
  setSubmitting,
  onCreated,
}: NewGroupDialogProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [enabled, setEnabled] = useState(true);

  function reset() {
    setName("");
    setDescription("");
    setEnabled(true);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("名称必填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/user-groups", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
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
      const created = (await res.json()) as GroupRow;
      onCreated(created);
      toast.success(`用户组 ${created.name} 已创建`);
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
      <DialogContent data-testid="new-group-dialog">
        <DialogHeader>
          <DialogTitle>新建用户组</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="名称" required htmlFor="new-group-name">
            <Input
              id="new-group-name"
              data-testid="new-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 Engineering Team"
            />
          </Field>
          <Field label="描述" htmlFor="new-group-description">
            <Input
              id="new-group-description"
              data-testid="new-group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选"
            />
          </Field>
          <Field label="启用" htmlFor="new-group-enabled">
            <input
              id="new-group-enabled"
              data-testid="new-group-enabled"
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
            data-testid="new-group-submit"
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
/* 编辑用户组对话框                                                            */
/* -------------------------------------------------------------------------- */

interface EditGroupDialogProps {
  group: GroupRow;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onUpdated: (group: GroupRow) => void;
}

function EditGroupDialog({
  group,
  onOpenChange,
  submitting,
  setSubmitting,
  onUpdated,
}: EditGroupDialogProps) {
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description ?? "");
  const [enabled, setEnabled] = useState(group.enabled);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("名称必填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/user-groups/${group.id}`, {
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
      const updated = (await res.json()) as GroupRow;
      onUpdated(updated);
      toast.success(`用户组 ${updated.name} 已更新`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent data-testid="edit-group-dialog">
        <DialogHeader>
          <DialogTitle>编辑用户组</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="名称" required htmlFor="edit-group-name">
            <Input
              id="edit-group-name"
              data-testid="edit-group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="描述" htmlFor="edit-group-description">
            <Input
              id="edit-group-description"
              data-testid="edit-group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="启用" htmlFor="edit-group-enabled">
            <input
              id="edit-group-enabled"
              data-testid="edit-group-enabled"
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
            data-testid="edit-group-submit"
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