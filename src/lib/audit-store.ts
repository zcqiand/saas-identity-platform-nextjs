import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { auditLogs, type AuditLog } from "@/db/schema";

/** M05.F01.I08 — 审计 store actions 内部接口 */

export function listAuditLogs(filter?: { action?: string; operator?: string }): AuditLog[] {
  const conditions = [];
  if (filter?.action) conditions.push(eq(auditLogs.action, filter.action));
  if (filter?.operator) conditions.push(eq(auditLogs.operator, filter.operator));
  const where = conditions.length === 1 ? conditions[0] : conditions.length > 1 ? conditions[0] : undefined;
  const baseQuery = db.select().from(auditLogs);
  const all = where ? baseQuery.where(where).all() : baseQuery.all();
  return all.sort((a, b) => b.id - a.id);
}

export function getAuditLog(id: number): AuditLog | null {
  return db.select().from(auditLogs).where(eq(auditLogs.id, id)).get() ?? null;
}

export function writeAuditLog(input: {
  action: string;
  operator: string;
  resource: string;
  resourceId: string;
  ip?: string;
  detail?: string;
}): AuditLog {
  return db
    .insert(auditLogs)
    .values({
      action: input.action,
      operator: input.operator,
      resource: input.resource,
      resourceId: input.resourceId,
      ip: input.ip ?? "127.0.0.1",
      detail: input.detail ?? "",
    })
    .returning()
    .get();
}