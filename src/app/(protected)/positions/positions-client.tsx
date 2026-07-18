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
 * M02.F03 岗位管理（client）
 *
 * fn-ID 覆盖：
 *   - I01 页面根 → data-fn="M02.F03.I01"
 *   - I02 列表查询 → 渲染 positions
 *   - I03 新建岗位 → 顶部按钮 + NewPositionDialog 调 POST /api/positions
 *   - I04 编辑岗位 → 行内按钮 + EditPositionDialog 调 PUT /api/positions/[id]
 *   - I05 删除岗位 → 行内按钮 + ConfirmDialog 二次确认后 DELETE
 */
// @entry M02.F03.I02 列表查询（listPositions on mount）
export interface PositionRow extends Record<string, unknown> {
  id: number;
  code: string;
  name: string;
  description: string | null;
  sort: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  members?: number[];
}

export interface PositionsClientProps {
  initialPositions: PositionRow[];
}

export function PositionsClient({ initialPositions }: PositionsClientProps) {
  const [positions, setPositions] = useState<PositionRow[]>(initialPositions);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<PositionRow | null>(null);
  const [deleting, setDeleting] = useState<PositionRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/positions/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `删除失败 (${res.status})`);
        return;
      }
      setPositions(positions.filter((p) => p.id !== deleting.id));
      toast.success(`岗位 ${deleting.code} 已删除`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="positions-page"
      data-fn="M02.F03.I01"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>岗位管理</CardTitle>
          <Button
            data-testid="new-position-btn"
            data-fn="M02.F03.I03"
            onClick={() => setCreateOpen(true)}
          >
            新建岗位
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((p) => (
                <TableRow key={p.id} data-testid="position-row">
                  <TableCell className="font-mono">{p.code}</TableCell>
                  <TableCell>{p.name}</TableCell>
                  <TableCell>{p.sort}</TableCell>
                  <TableCell>{p.enabled ? "✓" : "✗"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      data-testid="edit-position-btn"
                      data-fn="M02.F03.I04"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(p)}
                    >
                      编辑
                    </Button>
                    <Button
                      data-testid="delete-position-btn"
                      data-fn="M02.F03.I05"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleting(p)}
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

      <NewPositionDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        submitting={submitting}
        setSubmitting={setSubmitting}
        onCreated={(p) => setPositions((prev) => [...prev, p])}
      />

      {editing ? (
        <EditPositionDialog
          position={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onUpdated={(p) =>
            setPositions((prev) => prev.map((x) => (x.id === p.id ? p : x)))
          }
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`确认删除岗位「${deleting?.name ?? ""}」？`}
        description="关联用户会自动解绑。"
        confirmText="删除"
        destructive
        loading={submitting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 新建岗位对话框                                                              */
/* -------------------------------------------------------------------------- */

interface NewPositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCreated: (position: PositionRow) => void;
}

function NewPositionDialog({
  open,
  onOpenChange,
  submitting,
  setSubmitting,
  onCreated,
}: NewPositionDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sort, setSort] = useState("0");
  const [enabled, setEnabled] = useState(true);

  function reset() {
    setCode("");
    setName("");
    setDescription("");
    setSort("0");
    setEnabled(true);
  }

  async function handleSubmit() {
    if (!code.trim() || !name.trim()) {
      toast.error("Code 和名称必填");
      return;
    }
    const sortNum = Number(sort);
    setSubmitting(true);
    try {
      const res = await fetch("/api/positions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
          sort: Number.isFinite(sortNum) ? sortNum : 0,
          enabled,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `创建失败 (${res.status})`);
        return;
      }
      const created = (await res.json()) as PositionRow;
      onCreated(created);
      toast.success(`岗位 ${created.code} 已创建`);
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
      <DialogContent data-testid="new-position-dialog">
        <DialogHeader>
          <DialogTitle>新建岗位</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Code" required htmlFor="new-position-code">
            <Input
              id="new-position-code"
              data-testid="new-position-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="如 eng-mgr"
            />
          </Field>
          <Field label="名称" required htmlFor="new-position-name">
            <Input
              id="new-position-name"
              data-testid="new-position-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 工程经理"
            />
          </Field>
          <Field label="描述" htmlFor="new-position-description">
            <Input
              id="new-position-description"
              data-testid="new-position-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="可选"
            />
          </Field>
          <Field label="排序" htmlFor="new-position-sort">
            <Input
              id="new-position-sort"
              data-testid="new-position-sort"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </Field>
          <Field label="启用" htmlFor="new-position-enabled">
            <input
              id="new-position-enabled"
              data-testid="new-position-enabled"
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
            data-testid="new-position-submit"
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
/* 编辑岗位对话框                                                              */
/* -------------------------------------------------------------------------- */

interface EditPositionDialogProps {
  position: PositionRow;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onUpdated: (position: PositionRow) => void;
}

function EditPositionDialog({
  position,
  onOpenChange,
  submitting,
  setSubmitting,
  onUpdated,
}: EditPositionDialogProps) {
  const [name, setName] = useState(position.name);
  const [description, setDescription] = useState(position.description ?? "");
  const [sort, setSort] = useState(String(position.sort));
  const [enabled, setEnabled] = useState(position.enabled);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("名称必填");
      return;
    }
    const sortNum = Number(sort);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/positions/${position.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          sort: Number.isFinite(sortNum) ? sortNum : 0,
          enabled,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `保存失败 (${res.status})`);
        return;
      }
      const updated = (await res.json()) as PositionRow;
      onUpdated(updated);
      toast.success(`岗位 ${updated.code} 已更新`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent data-testid="edit-position-dialog">
        <DialogHeader>
          <DialogTitle>编辑岗位</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Code" htmlFor="edit-position-code" hint="不可修改">
            <Input
              id="edit-position-code"
              data-testid="edit-position-code"
              value={position.code}
              disabled
              readOnly
            />
          </Field>
          <Field label="名称" required htmlFor="edit-position-name">
            <Input
              id="edit-position-name"
              data-testid="edit-position-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="描述" htmlFor="edit-position-description">
            <Input
              id="edit-position-description"
              data-testid="edit-position-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field label="排序" htmlFor="edit-position-sort">
            <Input
              id="edit-position-sort"
              data-testid="edit-position-sort"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </Field>
          <Field label="启用" htmlFor="edit-position-enabled">
            <input
              id="edit-position-enabled"
              data-testid="edit-position-enabled"
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
            data-testid="edit-position-submit"
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