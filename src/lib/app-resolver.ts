import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * path 参数 appId 可能是 UUID（apps.id）或 app code（apps.code，如 "lab-management"）。
 * 前端 MenuTreePage 混用 MSW fixtures（语义键）与 API，实际会传来 code 或 UUID。
 * 统一解析成 apps.id；查不到返 null。
 */
export async function resolveAppId(appId: string): Promise<string | null> {
  const col = UUID_RE.test(appId) ? apps.id : apps.code;
  const rows = await db
    .select({ id: apps.id })
    .from(apps)
    .where(eq(col, appId))
    .limit(1);
  return rows[0]?.id ?? null;
}
