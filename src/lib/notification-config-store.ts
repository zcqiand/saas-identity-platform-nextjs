/**
 * M06.F09.I05 通知配置 singleton — notification_config 表 store
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 notificationConfig 表。
 * 单例：id 固定为 "default"；get 返回该行（不存在则取首行）；upsert 不存在则插入。
 */
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  notificationConfig,
  type NewNotificationConfig,
  type NotificationConfig,
} from "@/db/schema";

const SINGLETON_ID = "default";

export async function getNotificationConfig(): Promise<NotificationConfig | null> {
  const [row] = await db
    .select()
    .from(notificationConfig)
    .where(eq(notificationConfig.id, SINGLETON_ID))
    .orderBy(asc(notificationConfig.updatedAt));
  return row ?? null;
}

export async function upsertNotificationConfig(
  values: Omit<NewNotificationConfig, "id" | "updatedAt">,
): Promise<NotificationConfig> {
  const existing = await getNotificationConfig();
  if (existing) {
    const merged: NewNotificationConfig = { ...existing, ...values };
    await db
      .update(notificationConfig)
      .set({
        emailEnabled: merged.emailEnabled,
        smsEnabled: merged.smsEnabled,
        inAppEnabled: merged.inAppEnabled,
        notifyOn: merged.notifyOn,
      })
      .where(eq(notificationConfig.id, existing.id));
    const updated = await getNotificationConfig();
    if (!updated) throw new Error("notification_config row missing after upsert");
    return updated;
  }
  const [row] = await db
    .insert(notificationConfig)
    .values({ id: SINGLETON_ID, ...values })
    .returning();
  if (!row) throw new Error("notification_config insert returned no row");
  return row;
}