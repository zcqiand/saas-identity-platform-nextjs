import "server-only";
import { eq, like } from "drizzle-orm";
import { db } from "@/db";
import { platformSettings, type PlatformSetting } from "@/db/schema";

/** M06 平台运营 — 单表 key-value store（8 个功能域共用） */
export function listPlatformSettings(): PlatformSetting[] {
  return db.select().from(platformSettings).all();
}

export function listPlatformSettingsByPrefix(prefix: string): PlatformSetting[] {
  return db
    .select()
    .from(platformSettings)
    .where(like(platformSettings.key, `${prefix}%`))
    .all();
}

export function getPlatformSetting(key: string): PlatformSetting | null {
  return (
    db
      .select()
      .from(platformSettings)
      .where(eq(platformSettings.key, key))
      .get() ?? null
  );
}

export function setPlatformSetting(
  key: string,
  value: string,
  description?: string,
): PlatformSetting {
  const existing = getPlatformSetting(key);
  if (existing) {
    db.update(platformSettings)
      .set({ value, description: description ?? existing.description })
      .where(eq(platformSettings.key, key))
      .run();
    return getPlatformSetting(key)!;
  }
  return db
    .insert(platformSettings)
    .values({ key, value, description: description ?? null })
    .returning()
    .get();
}