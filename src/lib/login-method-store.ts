/**
 * M06.F11 登录方式 — login_methods 表 CRUD store
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 loginMethods 表。
 * 登录方式集合在系统初始化时灌入；运行期主要做 enable/disable toggle。
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { loginMethods, type NewLoginMethod, type LoginMethod } from "@/db/schema";

export async function listLoginMethods(): Promise<LoginMethod[]> {
  return db.select().from(loginMethods);
}

export async function getLoginMethod(id: string): Promise<LoginMethod | null> {
  const [row] = await db.select().from(loginMethods).where(eq(loginMethods.id, id));
  return row ?? null;
}

export async function updateLoginMethod(
  id: string,
  patch: Partial<Pick<NewLoginMethod, "name" | "description" | "enabled" | "sort">>,
): Promise<LoginMethod | null> {
  const existing = await getLoginMethod(id);
  if (!existing) return null;
  const merged: NewLoginMethod = { ...existing, ...patch };
  await db
    .update(loginMethods)
    .set({
      name: merged.name,
      description: merged.description,
      enabled: merged.enabled,
      sort: merged.sort,
    })
    .where(eq(loginMethods.id, id));
  return getLoginMethod(id);
}