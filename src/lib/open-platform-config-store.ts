/**
 * M06.F09.I06 开放平台配置 singleton — open_platform_config 表 store
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 openPlatformConfig 表。
 * 单例：id 固定为 "default"；get 返回该行（不存在则取首行）；upsert 不存在则插入。
 */
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  openPlatformConfig,
  type NewOpenPlatformConfig,
  type OpenPlatformConfig,
} from "@/db/schema";

const SINGLETON_ID = "default";

export async function getOpenPlatformConfig(): Promise<OpenPlatformConfig | null> {
  const [row] = await db
    .select()
    .from(openPlatformConfig)
    .where(eq(openPlatformConfig.id, SINGLETON_ID))
    .orderBy(asc(openPlatformConfig.updatedAt));
  return row ?? null;
}

export async function upsertOpenPlatformConfig(
  values: Omit<NewOpenPlatformConfig, "id" | "updatedAt">,
): Promise<OpenPlatformConfig> {
  const existing = await getOpenPlatformConfig();
  if (existing) {
    const merged: NewOpenPlatformConfig = { ...existing, ...values };
    await db
      .update(openPlatformConfig)
      .set({
        apiEnabled: merged.apiEnabled,
        webhookEnabled: merged.webhookEnabled,
        sdkEnabled: merged.sdkEnabled,
        openScopes: merged.openScopes,
        callbackWhitelist: merged.callbackWhitelist,
      })
      .where(eq(openPlatformConfig.id, existing.id));
    const updated = await getOpenPlatformConfig();
    if (!updated) throw new Error("open_platform_config row missing after upsert");
    return updated;
  }
  const [row] = await db
    .insert(openPlatformConfig)
    .values({ id: SINGLETON_ID, ...values })
    .returning();
  if (!row) throw new Error("open_platform_config insert returned no row");
  return row;
}