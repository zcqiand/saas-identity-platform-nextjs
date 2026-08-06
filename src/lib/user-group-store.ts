import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userGroups, type NewUserGroup, type UserGroup } from "@/db/schema";

/** M03.F03.I05 — 用户组 store（CRUD） */

export async function listUserGroups(): Promise<UserGroup[]> {
  return db.select().from(userGroups);
}

export async function getUserGroup(id: number): Promise<UserGroup | null> {
  const [row] = await db.select().from(userGroups).where(eq(userGroups.id, id));
  return row ?? null;
}

export async function createUserGroup(input: {
  name: string;
  description?: string;
  enabled?: boolean;
}): Promise<UserGroup> {
  const [row] = await db
    .insert(userGroups)
    .values({
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? true,
    } satisfies NewUserGroup)
    .returning();
  return row!;
}

export async function updateUserGroup(
  id: number,
  patch: { name?: string; description?: string; enabled?: boolean },
): Promise<UserGroup | null> {
  const existing = await getUserGroup(id);
  if (!existing) return null;
  const merged: NewUserGroup = {
    ...existing,
    name: patch.name ?? existing.name,
    description: patch.description ?? existing.description,
    enabled: patch.enabled ?? existing.enabled,
  };
  await db.update(userGroups)
    .set({ name: merged.name, description: merged.description, enabled: merged.enabled })
    .where(eq(userGroups.id, id));
  return getUserGroup(id);
}

export async function deleteUserGroup(id: number): Promise<boolean> {
  await db.delete(userGroups).where(eq(userGroups.id, id));
  return true;
}
