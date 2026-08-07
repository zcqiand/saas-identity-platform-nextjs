import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys, type ApiKey, type NewApiKey } from "@/db/schema";

/** M04.F02.I04 — API Key store actions 内部接口 */

export async function listApiKeys(): Promise<ApiKey[]> {
  return db.select().from(apiKeys);
}

export async function getApiKey(id: string): Promise<ApiKey | null> {
  const [row] = await db.select().from(apiKeys).where(eq(apiKeys.id, id));
  return row ?? null;
}

export async function createApiKey(
  input: Omit<NewApiKey, "createdAt" | "lastUsedAt">,
): Promise<ApiKey> {
  const [row] = await db.insert(apiKeys).values(input).returning();
  return row!;
}

export async function toggleApiKey(id: string): Promise<ApiKey | null> {
  const existing = await getApiKey(id);
  if (!existing) return null;
  await db.update(apiKeys)
    .set({ enabled: !existing.enabled })
    .where(eq(apiKeys.id, id));
  return getApiKey(id);
}

export async function deleteApiKey(id: string): Promise<boolean> {
  const result = await db.delete(apiKeys).where(eq(apiKeys.id, id));
  return (result.rowCount ?? 0) > 0;
}
