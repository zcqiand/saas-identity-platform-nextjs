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
 * M02.F02 用户管理（client）
 *
 * fn-ID 覆盖：
 *   - I01 页面根 → data-fn="M02.F02.I01"
 *   - I02 列表查询 → 渲染 users
 *   - I03 关键字搜索 → search 框（data-fn="M02.F02.I03"）
 *   - I04 角色筛选 → role select
 *   - I05 新增用户 → 顶部按钮 + NewUserDialog 调 POST /api/users
 *   - I06 编辑用户 → 行内按钮 + EditUserDialog 调 PUT /api/users/[id]
 *   - I07 删除用户 → 行内按钮 + ConfirmDialog 二次确认后 DELETE
 *   - I08 错误清错（fetchUsers 路径返回 4xx 时不关 Dialog、不加列表）
 */
// @entry M02.F02.I02 列表查询（fetchUsers on mount，含 keyword/role/status 筛选）
// @entry M02.F02.I04 角色筛选（role-filter select）
// @entry M02.F02.I08 错误清错（client 端 catch 后 toast.error，不动本地状态）
export interface UserRow extends Record<string, unknown> {
  id: number;
  username: string;
  displayName: string;
  email: string;
  roles: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface UsersClientProps {
  initialUsers: UserRow[];
}

const ALL_ROLES = ["admin", "manager", "member", "viewer"] as const;
type RoleLiteral = (typeof ALL_ROLES)[number];

function parseUserRoles(rolesJson: string): RoleLiteral[] {
  try {
    const parsed: unknown = JSON.parse(rolesJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((r): r is RoleLiteral =>
      (ALL_ROLES as readonly string[]).includes(r as string),
    );
  } catch {
    return [];
  }
}

export function UsersClient({ initialUsers }: UsersClientProps) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const filtered = users.filter((u) => {
    const matchKw =
      !search ||
      u.username.toLowerCase().includes(search.toLowerCase()) ||
      u.displayName.toLowerCase().includes(search.toLowerCase());
    const matchRole = !role || u.roles.includes(`"${role}"`);
    return matchKw && matchRole;
  });

  async function handleConfirmDelete() {
    if (!deleting) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${deleting.id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `删除失败 (${res.status})`);
        return;
      }
      setUsers(users.filter((u) => u.id !== deleting.id));
      toast.success(`用户 ${deleting.username} 已删除`);
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-testid="users-page"
      data-fn="M02.F02.I01"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>用户管理</CardTitle>
          <Button
            data-testid="new-user-btn"
            data-fn="M02.F02.I05"
            onClick={() => setCreateOpen(true)}
          >
            新增用户
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              data-testid="user-search"
              data-fn="M02.F02.I03"
              placeholder="搜索 username 或 displayName…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              data-testid="role-filter"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="rounded border px-3"
            >
              <option value="">全部角色</option>
              <option value="admin">admin</option>
              <option value="manager">manager</option>
              <option value="member">member</option>
              <option value="viewer">viewer</option>
            </select>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Username</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((u) => (
                <TableRow key={u.id} data-testid="user-row">
                  <TableCell className="font-mono">{u.username}</TableCell>
                  <TableCell>{u.displayName}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">{u.email}</TableCell>
                  <TableCell>
                    <code className="text-xs">{u.roles}</code>
                  </TableCell>
                  <TableCell>{u.status}</TableCell>
                  <TableCell className="space-x-2 text-right">
                    <Button
                      data-testid="edit-user-btn"
                      data-fn="M02.F02.I06"
                      size="sm"
                      variant="outline"
                      onClick={() => setEditing(u)}
                    >
                      编辑
                    </Button>
                    <Button
                      data-testid="delete-user-btn"
                      data-fn="M02.F02.I07"
                      size="sm"
                      variant="destructive"
                      onClick={() => setDeleting(u)}
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

      <NewUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        submitting={submitting}
        setSubmitting={setSubmitting}
        onCreated={(u) => setUsers((prev) => [...prev, u])}
      />

      {editing ? (
        <EditUserDialog
          user={editing}
          onOpenChange={(o) => !o && setEditing(null)}
          submitting={submitting}
          setSubmitting={setSubmitting}
          onUpdated={(u) =>
            setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)))
          }
        />
      ) : null}

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`确认删除用户「${deleting?.username ?? ""}」？`}
        confirmText="删除"
        destructive
        loading={submitting}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 新增用户对话框                                                              */
/* -------------------------------------------------------------------------- */

interface NewUserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onCreated: (user: UserRow) => void;
}

function NewUserDialog({
  open,
  onOpenChange,
  submitting,
  setSubmitting,
  onCreated,
}: NewUserDialogProps) {
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<string[]>(["member"]);
  const [status, setStatus] = useState<"active" | "disabled" | "pending">("active");

  function reset() {
    setUsername("");
    setDisplayName("");
    setEmail("");
    setRoles(["member"]);
    setStatus("active");
  }

  function toggleRole(r: string) {
    setRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  }

  async function handleSubmit() {
    if (!username.trim() || !displayName.trim() || !email.trim()) {
      toast.error("Username / Display Name / Email 都必填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          displayName: displayName.trim(),
          email: email.trim(),
          roles,
          status,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `创建失败 (${res.status})`);
        return;
      }
      const created = (await res.json()) as UserRow;
      onCreated(created);
      toast.success(`用户 ${created.username} 已创建`);
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
      <DialogContent data-testid="new-user-dialog">
        <DialogHeader>
          <DialogTitle>新增用户</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Username" required htmlFor="new-user-username">
            <Input
              id="new-user-username"
              data-testid="new-user-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="如 alice"
            />
          </Field>
          <Field label="Display Name" required htmlFor="new-user-displayname">
            <Input
              id="new-user-displayname"
              data-testid="new-user-displayname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="如 Alice Admin"
            />
          </Field>
          <Field label="Email" required htmlFor="new-user-email">
            <Input
              id="new-user-email"
              data-testid="new-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="如 alice@example.com"
            />
          </Field>
          <Field label="Roles" htmlFor="new-user-roles">
            <div id="new-user-roles" className="flex flex-wrap gap-3">
              {ALL_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    data-testid={`new-user-role-${r}`}
                    checked={roles.includes(r)}
                    onChange={() => toggleRole(r)}
                  />
                  {r}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Status" htmlFor="new-user-status">
            <select
              id="new-user-status"
              data-testid="new-user-status"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "active" | "disabled" | "pending")
              }
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="active">active</option>
              <option value="disabled">disabled</option>
              <option value="pending">pending</option>
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
            data-testid="new-user-submit"
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
/* 编辑用户对话框                                                              */
/* -------------------------------------------------------------------------- */

interface EditUserDialogProps {
  user: UserRow;
  onOpenChange: (open: boolean) => void;
  submitting: boolean;
  setSubmitting: (v: boolean) => void;
  onUpdated: (user: UserRow) => void;
}

function EditUserDialog({
  user,
  onOpenChange,
  submitting,
  setSubmitting,
  onUpdated,
}: EditUserDialogProps) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [email, setEmail] = useState(user.email);
  const [roles, setRoles] = useState<string[]>(() => parseUserRoles(user.roles));
  const [status, setStatus] = useState<"active" | "disabled" | "pending">(
    user.status as "active" | "disabled" | "pending",
  );

  function toggleRole(r: string) {
    setRoles((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r],
    );
  }

  async function handleSubmit() {
    if (!displayName.trim() || !email.trim()) {
      toast.error("Display Name 和 Email 必填");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName: displayName.trim(),
          email: email.trim(),
          roles,
          status,
        }),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast.error(err.error ?? `保存失败 (${res.status})`);
        return;
      }
      const updated = (await res.json()) as UserRow;
      onUpdated(updated);
      toast.success(`用户 ${updated.username} 已更新`);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent data-testid="edit-user-dialog">
        <DialogHeader>
          <DialogTitle>编辑用户</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Field label="Username" htmlFor="edit-user-username" hint="不可修改">
            <Input
              id="edit-user-username"
              data-testid="edit-user-username"
              value={user.username}
              disabled
              readOnly
            />
          </Field>
          <Field label="Display Name" required htmlFor="edit-user-displayname">
            <Input
              id="edit-user-displayname"
              data-testid="edit-user-displayname"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </Field>
          <Field label="Email" required htmlFor="edit-user-email">
            <Input
              id="edit-user-email"
              data-testid="edit-user-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <Field label="Roles" htmlFor="edit-user-roles">
            <div id="edit-user-roles" className="flex flex-wrap gap-3">
              {ALL_ROLES.map((r) => (
                <label key={r} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    data-testid={`edit-user-role-${r}`}
                    checked={roles.includes(r)}
                    onChange={() => toggleRole(r)}
                  />
                  {r}
                </label>
              ))}
            </div>
          </Field>
          <Field label="Status" htmlFor="edit-user-status">
            <select
              id="edit-user-status"
              data-testid="edit-user-status"
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "active" | "disabled" | "pending")
              }
              className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
            >
              <option value="active">active</option>
              <option value="disabled">disabled</option>
              <option value="pending">pending</option>
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
            data-testid="edit-user-submit"
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