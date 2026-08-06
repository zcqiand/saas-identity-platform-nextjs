import "server-only";
import { eq, like } from "drizzle-orm";
import { db } from "@/db";
import { platformSettings, type PlatformSetting } from "@/db/schema";

/** M06 平台运营 — 单表 key-value store（8 个功能域共用） */
export async function listPlatformSettings(): Promise<PlatformSetting[]> {
  return db.select().from(platformSettings);
}

export async function listPlatformSettingsByPrefix(prefix: string): Promise<PlatformSetting[]> {
  return db
    .select()
    .from(platformSettings)
    .where(like(platformSettings.key, `${prefix}%`));
}

export async function getPlatformSetting(key: string): Promise<PlatformSetting | null> {
  const [row] = await db
    .select()
    .from(platformSettings)
    .where(eq(platformSettings.key, key));
  return row ?? null;
}

export async function setPlatformSetting(
  key: string,
  value: string,
  description?: string,
): Promise<PlatformSetting> {
  const existing = await getPlatformSetting(key);
  if (existing) {
    await db.update(platformSettings)
      .set({ value, description: description ?? existing.description })
      .where(eq(platformSettings.key, key));
    return (await getPlatformSetting(key))!;
  }
  const [row] = await db
    .insert(platformSettings)
    .values({ key, value, description: description ?? null })
    .returning();
  return row!;
}
