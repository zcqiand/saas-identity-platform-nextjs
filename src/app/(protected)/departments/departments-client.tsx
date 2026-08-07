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

// @entry M02.F01.I02 树形查询（getDepartmentTree 走 PG CTE 一次拉整棵树）
// @entry M02.F01.I08 部门表单弹窗（NewDepartmentDialog + EditDepartmentDialog 独立组件）

/**
 * M02.F01 部门管理（client table + 树形）
 *
 * v0.3.0 重命名（原 Org → Department，URL /api/orgs → /api/departments）：
 *   - I01 页面根 → data-testid="departments-page" data-fn="M02.F01.I01"
 *   - I02 树形查询 → 渲染整棵 DepartmentTreeNode[]
 *   - I03 新增根部门 → 顶部按钮 + Dialog，parentId=null
 *   - I04 新增子部门 → 顶部按钮 + Dialog，预填 parentId（pickable）
 *   - I05 编辑 → 行内按钮 + EditDepartmentDialog 调 PUT /api/departments/[id]
 *   - I06 删除 → 行内按钮 + ConfirmDialog 二次确认后调 DELETE
 *   - I08 部门表单弹窗（独立组件 NewDepartmentDialog + EditDepartmentDialog）—— 本文件内
 */
export interface DepartmentNode extends Record<string, unknown> {
  id: number;
  name: string;
  parentId: number | null;
  sort: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  depth?: number;
}

export interface DepartmentsClientProps {
  initialTree: DepartmentNode[];
}

export function DepartmentsClient({ initialTree }: DepartmentsClientProps) {
  const [tree, setTree] = useState<DepartmentNode[]>(initialTree);
  const [creating, setCreating] = useState<{ parentId: number | null } | null>(null);
  const [editing, setEditing] = useState<DepartmentNode | null>(null);
  const [deleting, setDeleting] = useState<DepartmentNode | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/departments/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `删除失败 (${res.status})`);
        return;
      }
      setTree(tree.filter((o) => o.id !== deleting.id));
      toast.success(`部门 ${deleting.name} 已删除`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="departments-page"
      data-fn="M02.F01.I01"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>部门管理</CardTitle>
          <div className="space-x-2">
            <Button
              data-testid="new-department-btn"
              data-fn="M02.F01.I03"
              size="sm"
              onClick={() => setCreating({ parentId: null })}
            >
              新增根部门
            </Button>
            <Button
              data-testid="new-department-btn"
              data-fn="M02.F01.I04"
              size="sm"
              variant="outline"
              onClick={() =>
                setCreating({
                  parentId: tree.find((o) => o.parentId === null)?.id ?? null,
                })
              }
            >
              新增子部门
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tree.map((o) => (
                <TableRow
                  key={o.id}
                  data-testid="department-row"
                  className={o.depth ? `ml-${(o.depth ?? 0) * 8}` : ""}
                >
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell>{o.sort}</TableCell>
                  <TableCell>{o.enabled ? "✓" : "✗"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      data-testid="edit-department-btn"
                      data-fn="M02.F01.I05"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(o)}
                    >
                      编辑
                    </Button>
                    <Button
                      data-testid="delete-department-btn"
                      data-fn="M02.F01.I06"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleting(o)}
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

      {creating ? (
        <NewDepartmentDialog
          parentId={creating.parentId}
          tree={tree}
          open
          onOpenChange={(o) => !o && setCreating(null)}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onCreated={(o) => {
            setTree((prev) => [...prev, o]);
            setCreating(null);
          }}
        />
      ) : null}

      {editing ? (
        <EditDepartmentDialog
          department={editing}
          tree={tree}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onUpdated={(o) => {
            setTree((prev) => prev.map((x) => (x.id === o.id ? o : x)));
            setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`确认删除部门「${deleting?.name ?? ""}」？`}
        description="子节点会变成独立根部门。"
        confirmText="删除"
        destructive
        loading={submitting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 新增部门对话框                                                              */
/* -------------------------------------------------------------------------- */

interface NewDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: number | null;
  tree: DepartmentNode[];
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCreated: (dept: DepartmentNode) => void;
}

function NewDepartmentDialog({
  open,
  onOpenChange,
  parentId,
  tree,
  submitting,
  setSubmitting,
  onCreated,
}: NewDepartmentDialogProps) {
  const [name, setName] = useState("");
  const [pickedParentId, setPickedParentId] = useState<string>(
    () => (parentId === null ? "" : String(parentId)),
  );
  const [sort, setSort] = useState("0");
  const [enabled, setEnabled] = useState(true);

  function reset() {
    setName("");
    setPickedParentId(parentId === null ? "" : String(parentId));
    setSort("0");
    setEnabled(true);
  }

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("名称必填");
      return;
    }
    const sortNum = Number(sort);
    setSubmitting(true);
    try {
      const res = await fetch("/api/departments", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parentId: pickedParentId === "" ? null : Number(pickedParentId),
          sort: Number.isFinite(sortNum) ? sortNum : 0,
          enabled,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `创建失败 (${res.status})`);
        return;
      }
      const created = (await res.json()) as DepartmentNode;
      onCreated(created);
      toast.success(`部门 ${created.name} 已创建`);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="new-department-dialog">
        <DialogHeader>
          <DialogTitle>{parentId === null ? "新增根部门" : "新增子部门"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="名称" required htmlFor="new-department-name">
            <Input
              id="new-department-name"
              data-testid="new-department-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 Engineering"
            />
          </Field>
          <Field label="父部门" htmlFor="new-department-parent" hint="留空=根部门">
            <select
              id="new-department-parent"
              data-testid="new-department-parent"
              value={pickedParentId}
              onChange={(e) => setPickedParentId(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">（无 — 根部门）</option>
              {tree.map((o) => (
                <option key={o.id} value={o.id}>
                  {"　".repeat(o.depth ?? 0)}
                  {o.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="排序" htmlFor="new-department-sort">
            <Input
              id="new-department-sort"
              data-testid="new-department-sort"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </Field>
          <Field label="启用" htmlFor="new-department-enabled">
            <input
              id="new-department-enabled"
              data-testid="new-department-enabled"
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
            onClick={() => {
              reset();
              onOpenChange(false);
            }}
            disabled={submitting}
          >
            取消
          </Button>
          <Button
            data-testid="new-department-submit"
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
/* 编辑部门对话框                                                              */
/* -------------------------------------------------------------------------- */

interface EditDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: DepartmentNode;
  tree: DepartmentNode[];
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onUpdated: (dept: DepartmentNode) => void;
}

function EditDepartmentDialog({
  open,
  onOpenChange,
  department,
  tree,
  submitting,
  setSubmitting,
  onUpdated,
}: EditDepartmentDialogProps) {
  const [name, setName] = useState(department.name);
  const [pickedParentId, setPickedParentId] = useState<string>(
    () => (department.parentId === null ? "" : String(department.parentId)),
  );
  const [sort, setSort] = useState(String(department.sort));
  const [enabled, setEnabled] = useState(department.enabled);

  async function handleSubmit() {
    if (!name.trim()) {
      toast.error("名称必填");
      return;
    }
    const sortNum = Number(sort);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/departments/${department.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          parentId: pickedParentId === "" ? null : Number(pickedParentId),
          sort: Number.isFinite(sortNum) ? sortNum : 0,
          enabled,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `保存失败 (${res.status})`);
        return;
      }
      const updated = (await res.json()) as DepartmentNode;
      onUpdated(updated);
      toast.success(`部门 ${updated.name} 已更新`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="edit-department-dialog">
        <DialogHeader>
          <DialogTitle>编辑部门</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="名称" required htmlFor="edit-department-name">
            <Input
              id="edit-department-name"
              data-testid="edit-department-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="父部门" htmlFor="edit-department-parent" hint="不能选自己或自己的子孙">
            <select
              id="edit-department-parent"
              data-testid="edit-department-parent"
              value={pickedParentId}
              onChange={(e) => setPickedParentId(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">（无 — 根部门）</option>
              {tree
                .filter((o) => o.id !== department.id)
                .map((o) => (
                  <option key={o.id} value={o.id}>
                    {"　".repeat(o.depth ?? 0)}
                    {o.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="排序" htmlFor="edit-department-sort">
            <Input
              id="edit-department-sort"
              data-testid="edit-department-sort"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </Field>
          <Field label="启用" htmlFor="edit-department-enabled">
            <input
              id="edit-department-enabled"
              data-testid="edit-department-enabled"
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
            data-testid="edit-department-submit"
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