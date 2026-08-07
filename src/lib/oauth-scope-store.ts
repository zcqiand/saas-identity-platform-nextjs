/**
 * M06.F10 OAuth scope 注册表 — oauth_scopes 表 CRUD store
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 oauthScopes 表。
 * scope 按 appId 分组管理；listByApp 用于应用详情页的 scope 选择器。
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthScopes, type NewOauthScope, type OauthScope } from "@/db/schema";

export async function listOauthScopes(): Promise<OauthScope[]> {
  return db.select().from(oauthScopes);
}

export async function listOauthScopesByApp(appId: string): Promise<OauthScope[]> {
  return db.select().from(oauthScopes).where(eq(oauthScopes.appId, appId));
}

export async function getOauthScope(id: string): Promise<OauthScope | null> {
  const [row] = await db.select().from(oauthScopes).where(eq(oauthScopes.id, id));
  return row ?? null;
}

export async function createOauthScope(
  input: Pick<NewOauthScope, "id" | "appId" | "name" | "description" | "category" | "riskLevel"> &
    Partial<Pick<NewOauthScope, "enabled">>,
): Promise<OauthScope> {
  const [row] = await db.insert(oauthScopes).values(input).returning();
  if (!row) throw new Error("oauth_scope insert returned no row");
  return row;
}

export async function updateOauthScope(
  id: string,
  patch: Partial<Pick<NewOauthScope, "name" | "description" | "category" | "riskLevel" | "enabled">>,
): Promise<OauthScope | null> {
  const existing = await getOauthScope(id);
  if (!existing) return null;
  const merged: NewOauthScope = { ...existing, ...patch };
  await db
    .update(oauthScopes)
    .set({
      name: merged.name,
      description: merged.description,
      category: merged.category,
      riskLevel: merged.riskLevel,
      enabled: merged.enabled,
    })
    .where(eq(oauthScopes.id, id));
  return getOauthScope(id);
}

export async function deleteOauthScope(id: string): Promise<boolean> {
  const result = await db.delete(oauthScopes).where(eq(oauthScopes.id, id));
  return (result.rowCount ?? 0) > 0;
}