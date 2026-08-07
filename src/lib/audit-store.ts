import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, type AuditLog, type NewAuditLog } from "@/db/schema";

/** M05.F01.I08 — 审计 store actions 内部接口 */

export async function listAuditLogs(filter?: { action?: string; operator?: string }): Promise<AuditLog[]> {
  const conditions = [];
  if (filter?.action) conditions.push(eq(auditLogs.action, filter.action));
  if (filter?.operator) conditions.push(eq(auditLogs.operator, filter.operator));
  const where = conditions.length === 1 ? conditions[0] : conditions.length > 1 ? conditions[0] : undefined;
  const baseQuery = db.select().from(auditLogs);
  const all = where ? await baseQuery.where(where) : await baseQuery;
  return all.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

export async function getAuditLog(id: string): Promise<AuditLog | null> {
  const [row] = await db.select().from(auditLogs).where(eq(auditLogs.id, id));
  return row ?? null;
}

export async function writeAuditLog(input: {
  id: string;
  action: string;
  operator: string;
  resource: string;
  resourceId: string;
  ip?: string;
  detail?: string;
}): Promise<AuditLog> {
  const [row] = await db
    .insert(auditLogs)
    .values({
      id: input.id,
      action: input.action,
      operator: input.operator,
      resource: input.resource,
      resourceId: input.resourceId,
      ip: input.ip ?? "127.0.0.1",
      detail: input.detail ?? "",
    } satisfies Omit<NewAuditLog, "tenantId" | "timestamp">)
    .returning();
  return row!;
}
