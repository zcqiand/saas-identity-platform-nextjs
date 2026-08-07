/**
 * M06.F13 OAuth2 提供商 — oauth2_providers 表 CRUD store
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 oauth2Providers 表。
 * provider 字段区分具体外部 OAuth2 服务商（github / google / feishu 等）。
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { oauth2Providers, type NewOauth2Provider, type Oauth2Provider } from "@/db/schema";

export async function listOauth2Providers(): Promise<Oauth2Provider[]> {
  return db.select().from(oauth2Providers);
}

export async function getOauth2Provider(id: string): Promise<Oauth2Provider | null> {
  const [row] = await db
    .select()
    .from(oauth2Providers)
    .where(eq(oauth2Providers.id, id));
  return row ?? null;
}

export async function createOauth2Provider(
  input: Pick<NewOauth2Provider, "id" | "name" | "provider" | "enabled"> &
    Partial<Pick<NewOauth2Provider, "clientId">>,
): Promise<Oauth2Provider> {
  const [row] = await db.insert(oauth2Providers).values(input).returning();
  if (!row) throw new Error("oauth2_provider insert returned no row");
  return row;
}

export async function updateOauth2Provider(
  id: string,
  patch: Partial<Pick<NewOauth2Provider, "name" | "provider" | "clientId" | "enabled">>,
): Promise<Oauth2Provider | null> {
  const existing = await getOauth2Provider(id);
  if (!existing) return null;
  const merged: NewOauth2Provider = { ...existing, ...patch };
  await db
    .update(oauth2Providers)
    .set({
      name: merged.name,
      provider: merged.provider,
      clientId: merged.clientId,
      enabled: merged.enabled,
    })
    .where(eq(oauth2Providers.id, id));
  return getOauth2Provider(id);
}

export async function deleteOauth2Provider(id: string): Promise<boolean> {
  const result = await db.delete(oauth2Providers).where(eq(oauth2Providers.id, id));
  return (result.rowCount ?? 0) > 0;
}