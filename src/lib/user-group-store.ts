import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { userGroups, type NewUserGroup, type UserGroup } from "@/db/schema";

/** M03.F03.I05 — 用户组 store（CRUD）
 *  v0.3.0：PK 改 text；tenantId required
 */

export async function listUserGroups(): Promise<UserGroup[]> {
  return db.select().from(userGroups);
}

export async function getUserGroup(id: string): Promise<UserGroup | null> {
  const [row] = await db.select().from(userGroups).where(eq(userGroups.id, id));
  return row ?? null;
}

export async function createUserGroup(input: {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  enabled?: boolean;
}): Promise<UserGroup> {
  const [row] = await db
    .insert(userGroups)
    .values({
      id: input.id,
      tenantId: input.tenantId,
      name: input.name,
      description: input.description,
      enabled: input.enabled ?? true,
    } satisfies Omit<NewUserGroup, "createdAt" | "updatedAt">)
    .returning();
  return row!;
}

export async function updateUserGroup(
  id: string,
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

export async function deleteUserGroup(id: string): Promise<boolean> {
  const result = await db.delete(userGroups).where(eq(userGroups.id, id));
  return (result.rowCount ?? 0) > 0;
}