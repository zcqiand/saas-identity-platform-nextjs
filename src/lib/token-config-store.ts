/**
 * M06.F09.I01 Token 配置 singleton — token_config 表 store
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 tokenConfig 表。
 * 单例：id 固定为 "default"；get 返回该行（不存在则取首行）；upsert 不存在则插入。
 */
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { tokenConfig, type NewTokenConfig, type TokenConfig } from "@/db/schema";

const SINGLETON_ID = "default";

export async function getTokenConfig(): Promise<TokenConfig | null> {
  const [row] = await db
    .select()
    .from(tokenConfig)
    .where(eq(tokenConfig.id, SINGLETON_ID))
    .orderBy(asc(tokenConfig.updatedAt));
  return row ?? null;
}

export async function upsertTokenConfig(
  values: Omit<NewTokenConfig, "id" | "updatedAt">,
): Promise<TokenConfig> {
  const existing = await getTokenConfig();
  if (existing) {
    const merged: NewTokenConfig = { ...existing, ...values };
    await db
      .update(tokenConfig)
      .set({
        accessTokenTtl: merged.accessTokenTtl,
        refreshTokenTtl: merged.refreshTokenTtl,
        refreshTokenEnabled: merged.refreshTokenEnabled,
        tokenRevocationEnabled: merged.tokenRevocationEnabled,
      })
      .where(eq(tokenConfig.id, existing.id));
    const updated = await getTokenConfig();
    if (!updated) throw new Error("token_config row missing after upsert");
    return updated;
  }
  const [row] = await db
    .insert(tokenConfig)
    .values({ id: SINGLETON_ID, ...values })
    .returning();
  if (!row) throw new Error("token_config insert returned no row");
  return row;
}