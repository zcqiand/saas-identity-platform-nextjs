import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, type ApiKey } from "@/db/schema";

/** M04.F02.I04 — API Key store actions 内部接口 */

export function listApiKeys(): ApiKey[] {
  return db.select().from(apiKeys).all();
}

export function getApiKey(id: number): ApiKey | null {
  return db.select().from(apiKeys).where(eq(apiKeys.id, id)).get() ?? null;
}

export function createApiKey(input: {
  name: string;
  key: string;
  appId: number;
  expiresAt?: string;
  enabled?: boolean;
}): ApiKey {
  return db
    .insert(apiKeys)
    .values({
      name: input.name,
      key: input.key,
      appId: input.appId,
      expiresAt: input.expiresAt ?? "never",
      enabled: input.enabled ?? true,
    })
    .returning()
    .get();
}

export function toggleApiKey(id: number): ApiKey | null {
  const existing = getApiKey(id);
  if (!existing) return null;
  db.update(apiKeys)
    .set({ enabled: !existing.enabled })
    .where(eq(apiKeys.id, id))
    .run();
  return getApiKey(id);
}

export function deleteApiKey(id: number): boolean {
  const result = db.delete(apiKeys).where(eq(apiKeys.id, id)).run();
  return result.changes > 0;
}