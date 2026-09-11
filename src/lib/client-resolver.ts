import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthClient } from "@/db/schema";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * path 参数 clientId 可能是 UUID（oauthClient.id）或 clientId（如 "lab-management"）。
 * 前端 MenuTreePage 混用 MSW fixtures（语义键）与 API，实际会传来 clientId 或 UUID。
 * 统一解析成 oauthClient.id；查不到返 null。
 */
export async function resolveClientId(clientId: string): Promise<string | null> {
  const col = UUID_RE.test(clientId) ? oauthClient.id : oauthClient.clientId;
  const rows = await db
    .select({ id: oauthClient.id })
    .from(oauthClient)
    .where(eq(col, clientId))
    .limit(1);
  return rows[0]?.id ?? null;
}

/**
 * 同上，但返回整行（id + client_id 列值）。
 * 注意：sys_menu.client_id 存的是「code 形态」值（seed 原样），
 * 查 sys_menu 必须用 client_id 列值，而不是 id —— 两者在 DB 中并不总是相等。
 */
export async function resolveClientRow(
  clientId: string,
): Promise<{ id: string; clientId: string } | null> {
  const col = UUID_RE.test(clientId) ? oauthClient.id : oauthClient.clientId;
  const rows = await db
    .select({ id: oauthClient.id, clientId: oauthClient.clientId })
    .from(oauthClient)
    .where(eq(col, clientId))
    .limit(1);
  return rows[0] ?? null;
}
