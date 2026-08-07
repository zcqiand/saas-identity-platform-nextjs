/**
 * M06.F09.I03 密码策略 singleton — password_policy 表 store
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 passwordPolicy 表。
 * 单例：id 固定为 "default"；get 返回该行（不存在则取首行）；upsert 不存在则插入。
 */
import "server-only";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { passwordPolicy, type NewPasswordPolicy, type PasswordPolicy } from "@/db/schema";

const SINGLETON_ID = "default";

export async function getPasswordPolicy(): Promise<PasswordPolicy | null> {
  const [row] = await db
    .select()
    .from(passwordPolicy)
    .where(eq(passwordPolicy.id, SINGLETON_ID))
    .orderBy(asc(passwordPolicy.updatedAt));
  return row ?? null;
}

export async function upsertPasswordPolicy(
  values: Omit<NewPasswordPolicy, "id" | "updatedAt">,
): Promise<PasswordPolicy> {
  const existing = await getPasswordPolicy();
  if (existing) {
    const merged: NewPasswordPolicy = { ...existing, ...values };
    await db
      .update(passwordPolicy)
      .set({
        minLength: merged.minLength,
        requireUppercase: merged.requireUppercase,
        requireLowercase: merged.requireLowercase,
        requireDigit: merged.requireDigit,
        requireSpecial: merged.requireSpecial,
        expireDays: merged.expireDays,
        historyCount: merged.historyCount,
        enabled: merged.enabled,
      })
      .where(eq(passwordPolicy.id, existing.id));
    const updated = await getPasswordPolicy();
    if (!updated) throw new Error("password_policy row missing after upsert");
    return updated;
  }
  const [row] = await db
    .insert(passwordPolicy)
    .values({ id: SINGLETON_ID, ...values })
    .returning();
  if (!row) throw new Error("password_policy insert returned no row");
  return row;
}