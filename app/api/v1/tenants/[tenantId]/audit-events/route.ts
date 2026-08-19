// /api/v1/tenants/:tenantId/audit-events — M06.F01.I01
//
// TypeSpec: tsp/routes/tenant-audit.tsp listAuditEvents(
//   @path tenantId,
//   @query page?, @query pageSize?, @query actorUserId?, @query action?, @query from?, @query to?
// ): Page<AuditEvent>

import { NextRequest, NextResponse } from "next/server";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const ACTIONS = [
  "user_created","user_updated","user_deleted",
  "role_assigned","role_revoked",
  "login_success","login_failed",
  "oauth_token_issued",
  "api_key_created","api_key_revoked",
] as const;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const url = new URL(req.url);
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
    const actorUserId = url.searchParams.get("actorUserId");
    const action = url.searchParams.get("action");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    const conds = [eq(auditEvents.tenantId, tenantId)];
    if (actorUserId) conds.push(eq(auditEvents.actorUserId, actorUserId));
    if (action && (ACTIONS as readonly string[]).includes(action)) {
      conds.push(eq(auditEvents.action, action as typeof ACTIONS[number]));
    }
    if (from) conds.push(gte(auditEvents.occurredAt, new Date(from)));
    if (to) conds.push(lte(auditEvents.occurredAt, new Date(to)));
    const where = and(...conds);

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(where);
    const total = totalResult[0]?.count ?? 0;

    const items = await db
      .select()
      .from(auditEvents)
      .where(where)
      .limit(pageSize)
      .offset(page * pageSize)
      .orderBy(sql`occurred_at DESC`);

    return NextResponse.json({
      items: items.map((e) => ({
        id: e.id,
        tenantId: e.tenantId,
        actorUserId: e.actorUserId ?? undefined,
        action: e.action,
        targetUserId: e.targetUserId ?? undefined,
        metadata: e.metadata,
        occurredAt: e.occurredAt.toISOString(),
      })),
      page,
      pageSize,
      total,
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}