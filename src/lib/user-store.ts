import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type NewUser, type User } from "@/db/schema";

/** M02.F02.I08 用户 store — CRUD + JSON roles 解析 */

export interface ListUsersFilter {
  keyword?: string;
  status?: string;
}

export function listUsers(filter: ListUsersFilter = {}): User[] {
  const all = db.select().from(users).all();
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

export function getUser(id: number): User | null {
  return db.select().from(users).where(eq(users.id, id)).get() ?? null;
}

export function getUserByEmail(email: string): User | null {
  return (
    db.select().from(users).where(eq(users.email, email)).get() ?? null
  );
}

export function createUser(input: {
  username: string;
  displayName: string;
  email: string;
  roles?: string[];
  status?: string;
}): User {
  const roles = input.roles ?? ["member"];
  return db
    .insert(users)
    .values({
      username: input.username,
      displayName: input.displayName,
      email: input.email,
      roles: JSON.stringify(roles),
      status: input.status ?? "active",
    } satisfies NewUser)
    .returning()
    .get();
}

export function updateUser(
  id: number,
  patch: {
    displayName?: string;
    email?: string;
    roles?: string[];
    status?: string;
  },
): User | null {
  const existing = getUser(id);
  if (!existing) return null;
  const merged: NewUser = {
    ...existing,
    displayName: patch.displayName ?? existing.displayName,
    email: patch.email ?? existing.email,
    roles: patch.roles ? JSON.stringify(patch.roles) : existing.roles,
    status: patch.status ?? existing.status,
  };
  db.update(users)
    .set({
      displayName: merged.displayName,
      email: merged.email,
      roles: merged.roles,
      status: merged.status,
    })
    .where(eq(users.id, id))
    .run();
  return getUser(id);
}

export function deleteUser(id: number): boolean {
  const result = db.delete(users).where(eq(users.id, id)).run();
  return result.changes > 0;
}