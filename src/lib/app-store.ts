import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps, type App, type NewApp } from "@/db/schema";

/** M04.F01.I12 — 应用 store actions 内部接口 */

export function listApps(): App[] {
  return db.select().from(apps).all();
}

export function getApp(id: number): App | null {
  return db.select().from(apps).where(eq(apps.id, id)).get() ?? null;
}

export function getAppByCode(code: string): App | null {
  return db.select().from(apps).where(eq(apps.code, code)).get() ?? null;
}

export function createApp(input: {
  code: string;
  name: string;
  type?: string;
  description?: string;
  enabled?: boolean;
}): App {
  return db
    .insert(apps)
    .values({
      code: input.code,
      name: input.name,
      type: input.type ?? "web",
      description: input.description,
      enabled: input.enabled ?? true,
    } satisfies NewApp)
    .returning()
    .get();
}

export function updateApp(
  id: number,
  patch: Partial<Pick<NewApp, "name" | "type" | "description" | "enabled">>,
): App | null {
  const existing = getApp(id);
  if (!existing) return null;
  const merged: NewApp = {
    ...existing,
    name: patch.name ?? existing.name,
    type: patch.type ?? existing.type,
    description: patch.description ?? existing.description,
    enabled: patch.enabled ?? existing.enabled,
  };
  db.update(apps)
    .set({
      name: merged.name,
      type: merged.type,
      description: merged.description,
      enabled: merged.enabled,
    })
    .where(eq(apps.id, id))
    .run();
  return getApp(id);
}

export function deleteApp(id: number): boolean {
  const result = db.delete(apps).where(eq(apps.id, id)).run();
  return result.changes > 0;
}