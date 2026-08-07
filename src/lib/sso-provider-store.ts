/**
 * M06.F12 SSO 提供商 — sso_providers 表 CRUD store
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 ssoProviders 表。
 * type 取值 "oidc" | "saml" | "cas"。
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { ssoProviders, type NewSsoProvider, type SsoProvider } from "@/db/schema";

export async function listSsoProviders(): Promise<SsoProvider[]> {
  return db.select().from(ssoProviders);
}

export async function getSsoProvider(id: string): Promise<SsoProvider | null> {
  const [row] = await db.select().from(ssoProviders).where(eq(ssoProviders.id, id));
  return row ?? null;
}

export async function createSsoProvider(
  input: Pick<NewSsoProvider, "id" | "name" | "type" | "enabled"> &
    Partial<Pick<NewSsoProvider, "clientId" | "issuerUrl">>,
): Promise<SsoProvider> {
  const [row] = await db.insert(ssoProviders).values(input).returning();
  if (!row) throw new Error("sso_provider insert returned no row");
  return row;
}

export async function updateSsoProvider(
  id: string,
  patch: Partial<
    Pick<NewSsoProvider, "name" | "type" | "clientId" | "issuerUrl" | "enabled">
  >,
): Promise<SsoProvider | null> {
  const existing = await getSsoProvider(id);
  if (!existing) return null;
  const merged: NewSsoProvider = { ...existing, ...patch };
  await db
    .update(ssoProviders)
    .set({
      name: merged.name,
      type: merged.type,
      clientId: merged.clientId,
      issuerUrl: merged.issuerUrl,
      enabled: merged.enabled,
    })
    .where(eq(ssoProviders.id, id));
  return getSsoProvider(id);
}

export async function deleteSsoProvider(id: string): Promise<boolean> {
  const result = await db.delete(ssoProviders).where(eq(ssoProviders.id, id));
  return (result.rowCount ?? 0) > 0;
}