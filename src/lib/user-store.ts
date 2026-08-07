import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type NewUser, type User } from "@/db/schema";

/** M02.F02.I08 用户 store — CRUD + roles (text[]) 透传 */

export interface ListUsersFilter {
  keyword?: string;
  status?: string;
}

export async function listUsers(filter: ListUsersFilter = {}): Promise<User[]> {
  const all = await db.select().from(users);
  let result = all;
  if (filter.keyword) {
    const kw = filter.keyword.toLowerCase();
    result = result.filter(
      (u) =>
        u.username.toLowerCase().includes(kw) ||
        u.displayName.toLowerCase().includes(kw),
    );
  }
  if (filter.status) {
    result = result.filter((u) => u.status === filter.status);
  }
  return result;
}

export async function getUser(id: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row ?? null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const [row] = await db.select().from(users).where(eq(users.email, email));
  return row ?? null;
}

export async function createUser(input: {
  id: string;
  username: string;
  displayName: string;
  email: string;
  tenantId: string;
  departmentId?: string;
  roles?: string[];
  status?: string;
}): Promise<User> {
  const roles = input.roles ?? ["member"];
  const [row] = await db
    .insert(users)
    .values({
      id: input.id,
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      tenantId: input.tenantId,
      departmentId: input.departmentId,
      roles,
      status: input.status ?? "active",
    } satisfies Omit<NewUser, "createdAt" | "updatedAt">)
    .returning();
  return row!;
}

export async function updateUser(
  id: string,
  patch: {
    displayName?: string;
    email?: string;
    roles?: string[];
    departmentId?: string;
    status?: string;
  },
): Promise<User | null> {
  const existing = await getUser(id);
  if (!existing) return null;
  const merged: NewUser = {
    ...existing,
    displayName: patch.displayName ?? existing.displayName,
    email: patch.email ?? existing.email,
    roles: patch.roles ?? existing.roles,
    departmentId: patch.departmentId ?? existing.departmentId,
    status: patch.status ?? existing.status,
  };
  await db.update(users)
    .set({
      displayName: merged.displayName,
      email: merged.email,
      roles: merged.roles,
      departmentId: merged.departmentId,
      status: merged.status,
    })
    .where(eq(users.id, id));
  return getUser(id);
}

export async function deleteUser(id: string): Promise<boolean> {
  const result = await db.delete(users).where(eq(users.id, id));
  return (result.rowCount ?? 0) > 0;
}
