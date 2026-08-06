import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps, type App, type NewApp } from "@/db/schema";

/** M04.F01.I12 — 应用 store actions 内部接口 */

export async function listApps(): Promise<App[]> {
  return db.select().from(apps);
}

export async function getApp(id: number): Promise<App | null> {
  const [row] = await db.select().from(apps).where(eq(apps.id, id));
  return row ?? null;
}

export async function getAppByCode(code: string): Promise<App | null> {
  const [row] = await db.select().from(apps).where(eq(apps.code, code));
  return row ?? null;
}

export async function createApp(input: {
  code: string;
  name: string;
  type?: string;
  description?: string;
  enabled?: boolean;
}): Promise<App> {
  const [row] = await db
    .insert(apps)
    .values({
      code: input.code,
      name: input.name,
      type: input.type ?? "web",
      description: input.description,
      enabled: input.enabled ?? true,
    } satisfies NewApp)
    .returning();
  return row!;
}

export async function updateApp(
  id: number,
  patch: Partial<Pick<NewApp, "name" | "type" | "description" | "enabled">>,
): Promise<App | null> {
  const existing = await getApp(id);
  if (!existing) return null;
  const merged: NewApp = {
    ...existing,
    name: patch.name ?? existing.name,
    type: patch.type ?? existing.type,
    description: patch.description ?? existing.description,
    enabled: patch.enabled ?? existing.enabled,
  };
  await db.update(apps)
    .set({
      name: merged.name,
      type: merged.type,
      description: merged.description,
      enabled: merged.enabled,
    })
    .where(eq(apps.id, id));
  return getApp(id);
}

export async function deleteApp(id: number): Promise<boolean> {
  const result = await db.delete(apps).where(eq(apps.id, id));
  return (result.rowCount ?? 0) > 0;
}
