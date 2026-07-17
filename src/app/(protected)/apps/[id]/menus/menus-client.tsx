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
 * M04.F01 应用菜单管理（client）
 *
 * fn-ID 覆盖：
 *   - I07 菜单列表页面 → data-testid="menus-page" data-fn="M04.F01.I07"
 *   - I08 新建菜单 → 顶部按钮 + NewMenuDialog 调 POST /api/menus（parentId=null）
 *   - I09 新建子菜单 → 行内按钮 + NewMenuDialog 预填 parentId
 *   - I10 编辑菜单 → 行内按钮 + EditMenuDialog 调 PUT /api/menus/[id]
 *   - I11 删除菜单 → 行内按钮 + ConfirmDialog 二次确认后 DELETE
 */
export interface MenuRow extends Record<string, unknown> {
  id: number;
  appId: number;
  parentId: number | null;
  code: string;
  name: string;
  path: string;
  sort: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  depth?: number;
}

export interface MenusClientProps {
  appId: number;
  appName: string;
  initialMenus: MenuRow[];
}

export function MenusClient({ appId, appName, initialMenus }: MenusClientProps) {
  const [menus, setMenus] = useState<MenuRow[]>(initialMenus);
  const [creating, setCreating] = useState<{ parentId: number | null } | null>(null);
  const [editing, setEditing] = useState<MenuRow | null>(null);
  const [deleting, setDeleting] = useState<MenuRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleConfirmDelete() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/menus/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `删除失败 (${res.status})`);
        return;
      }
      setMenus(menus.filter((m) => m.id !== deleting.id));
      toast.success(`菜单 ${deleting.code} 已删除`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="menus-page"
      data-fn="M04.F01.I07"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>应用「{appName}」菜单管理</CardTitle>
          <Button
            data-testid="new-menu-btn"
            data-fn="M04.F01.I08"
            onClick={() => setCreating({ parentId: null })}
          >
            新建根菜单
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>路径</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>启用</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {menus.map((m) => (
                <TableRow
                  key={m.id}
                  data-testid="menu-row"
                  className={m.depth ? `ml-${(m.depth ?? 0) * 8}` : ""}
                >
                  <TableCell className="font-mono">{m.code}</TableCell>
                  <TableCell>{m.name}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{m.path}</TableCell>
                  <TableCell>{m.sort}</TableCell>
                  <TableCell>{m.enabled ? "✓" : "✗"}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      data-testid="new-child-menu-btn"
                      data-fn="M04.F01.I09"
                      size="sm"
                      variant="outline"
                      onClick={() => setCreating({ parentId: m.id })}
                    >
                      新建子
                    </Button>
                    <Button
                      data-testid="edit-menu-btn"
                      data-fn="M04.F01.I10"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(m)}
                    >
                      编辑
                    </Button>
                    <Button
                      data-testid="delete-menu-btn"
                      data-fn="M04.F01.I11"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleting(m)}
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
        <NewMenuDialog
          appId={appId}
          parentId={creating.parentId}
          tree={menus}
          open
          onOpenChange={(o) => !o && setCreating(null)}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onCreated={(m) => {
            setMenus((prev) => [...prev, m]);
            setCreating(null);
          }}
        />
      ) : null}

      {editing ? (
        <EditMenuDialog
          menu={editing}
          tree={menus}
          open
          onOpenChange={(o) => !o && setEditing(null)}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onUpdated={(m) => {
            setMenus((prev) => prev.map((x) => (x.id === m.id ? m : x)));
            setEditing(null);
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`确认删除菜单「${deleting?.code ?? ""}」？`}
        description="子菜单会变成独立根菜单。"
        confirmText="删除"
        destructive
        loading={submitting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 新建菜单对话框                                                              */
/* -------------------------------------------------------------------------- */

interface NewMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appId: number;
  parentId: number | null;
  tree: MenuRow[];
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCreated: (menu: MenuRow) => void;
}

function NewMenuDialog({
  open,
  onOpenChange,
  appId,
  parentId,
  tree,
  submitting,
  setSubmitting,
  onCreated,
}: NewMenuDialogProps) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const [pickedParentId, setPickedParentId] = useState<string>(
    () => (parentId === null ? "" : String(parentId)),
  );
  const [sort, setSort] = useState("0");
  const [enabled, setEnabled] = useState(true);

  function reset() {
    setCode("");
    setName("");
    setPath("");
    setPickedParentId(parentId === null ? "" : String(parentId));
    setSort("0");
    setEnabled(true);
  }

  async function handleSubmit() {
    if (!code.trim() || !name.trim() || !path.trim()) {
      toast.error("Code / 名称 / 路径 都必填");
      return;
    }
    const sortNum = Number(sort);
    setSubmitting(true);
    try {
      const res = await fetch("/api/menus", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          appId,
          code: code.trim(),
          name: name.trim(),
          path: path.trim(),
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
      const created = (await res.json()) as MenuRow;
      onCreated(created);
      toast.success(`菜单 ${created.code} 已创建`);
      reset();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="new-menu-dialog">
        <DialogHeader>
          <DialogTitle>{parentId === null ? "新建根菜单" : "新建子菜单"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Code" required htmlFor="new-menu-code">
            <Input
              id="new-menu-code"
              data-testid="new-menu-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="如 dashboard"
            />
          </Field>
          <Field label="名称" required htmlFor="new-menu-name">
            <Input
              id="new-menu-name"
              data-testid="new-menu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="如 数据看板"
            />
          </Field>
          <Field label="路径" required htmlFor="new-menu-path">
            <Input
              id="new-menu-path"
              data-testid="new-menu-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="如 /dashboard"
            />
          </Field>
          <Field label="父菜单" htmlFor="new-menu-parent" hint="留空=根菜单">
            <select
              id="new-menu-parent"
              data-testid="new-menu-parent"
              value={pickedParentId}
              onChange={(e) => setPickedParentId(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">（无 — 根菜单）</option>
              {tree.map((m) => (
                <option key={m.id} value={m.id}>
                  {"　".repeat(m.depth ?? 0)}
                  {m.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="排序" htmlFor="new-menu-sort">
            <Input
              id="new-menu-sort"
              data-testid="new-menu-sort"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </Field>
          <Field label="启用" htmlFor="new-menu-enabled">
            <input
              id="new-menu-enabled"
              data-testid="new-menu-enabled"
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
            data-testid="new-menu-submit"
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
/* 编辑菜单对话框                                                              */
/* -------------------------------------------------------------------------- */

interface EditMenuDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  menu: MenuRow;
  tree: MenuRow[];
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onUpdated: (menu: MenuRow) => void;
}

function EditMenuDialog({
  open,
  onOpenChange,
  menu,
  tree,
  submitting,
  setSubmitting,
  onUpdated,
}: EditMenuDialogProps) {
  const [name, setName] = useState(menu.name);
  const [path, setPath] = useState(menu.path);
  const [pickedParentId, setPickedParentId] = useState<string>(
    () => (menu.parentId === null ? "" : String(menu.parentId)),
  );
  const [sort, setSort] = useState(String(menu.sort));
  const [enabled, setEnabled] = useState(menu.enabled);

  async function handleSubmit() {
    if (!name.trim() || !path.trim()) {
      toast.error("名称 和 路径 必填");
      return;
    }
    const sortNum = Number(sort);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/menus/${menu.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          path: path.trim(),
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
      const updated = (await res.json()) as MenuRow;
      onUpdated(updated);
      toast.success(`菜单 ${updated.code} 已更新`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="edit-menu-dialog">
        <DialogHeader>
          <DialogTitle>编辑菜单</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Code" htmlFor="edit-menu-code" hint="不可修改">
            <Input
              id="edit-menu-code"
              data-testid="edit-menu-code"
              value={menu.code}
              disabled
              readOnly
            />
          </Field>
          <Field label="名称" required htmlFor="edit-menu-name">
            <Input
              id="edit-menu-name"
              data-testid="edit-menu-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="路径" required htmlFor="edit-menu-path">
            <Input
              id="edit-menu-path"
              data-testid="edit-menu-path"
              value={path}
              onChange={(e) => setPath(e.target.value)}
            />
          </Field>
          <Field label="父菜单" htmlFor="edit-menu-parent" hint="不能选自己">
            <select
              id="edit-menu-parent"
              data-testid="edit-menu-parent"
              value={pickedParentId}
              onChange={(e) => setPickedParentId(e.target.value)}
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="">（无 — 根菜单）</option>
              {tree
                .filter((m) => m.id !== menu.id)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {"　".repeat(m.depth ?? 0)}
                    {m.name}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="排序" htmlFor="edit-menu-sort">
            <Input
              id="edit-menu-sort"
              data-testid="edit-menu-sort"
              type="number"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            />
          </Field>
          <Field label="启用" htmlFor="edit-menu-enabled">
            <input
              id="edit-menu-enabled"
              data-testid="edit-menu-enabled"
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
            data-testid="edit-menu-submit"
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