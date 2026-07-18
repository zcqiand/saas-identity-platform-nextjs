import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userGroups, type NewUserGroup, type UserGroup } from "@/db/schema";

/** M03.F03.I05 — 用户组 store（CRUD） */

export function listUserGroups(): UserGroup[] {
  return db.select().from(userGroups).all();
}

export function getUserGroup(id: number): UserGroup | null {
  return db.select().from(userGroups).where(eq(userGroups.id, id)).get() ?? null;
}

export function createUserGroup(input: {
  name: string;
  description?: string;
  enabled?: boolean;
}): UserGroup {
  return db
    .insert(userGroups)
    .values({
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? true,
    } satisfies NewUserGroup)
    .returning()
    .get();
}

export function updateUserGroup(
  id: number,
  patch: { name?: string; description?: string; enabled?: boolean },
): UserGroup | null {
  const existing = getUserGroup(id);
  if (!existing) return null;
  const merged: NewUserGroup = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    enabled: patch.enabled ?? existing.enabled,
  };
  db.update(userGroups)
    .set({ name: merged.name, description: merged.description, enabled: merged.enabled })
    .where(eq(userGroups.id, id))
    .run();
  return getUserGroup(id);
}

export function deleteUserGroup(id: number): boolean {
  const result = db.delete(userGroups).where(eq(userGroups.id, id)).run();
  return result.changes > 0;
}