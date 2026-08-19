// /api/v1/tenants/:tenantId/audit-events/by-user/:userId — M06.F01.I02
//
// TypeSpec: listAuditEventsByUser(@path tenantId, @path userId, @query page?, @query pageSize?)

import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; userId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, userId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const url = new URL(req.url);
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));

    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(auditEvents)
      .where(eq(auditEvents.actorUserId, userId));
    const total = totalResult[0]?.count ?? 0;

    const items = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.actorUserId, userId))
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