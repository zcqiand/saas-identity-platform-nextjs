// /api/v1/tenants/:tenantId/audit-events/retention — M06.F02.I01 / I02
//
// TypeSpec: getRetentionPolicy / setRetentionPolicy
// GET / PUT

import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditRetentionPolicies } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const PutBody = z.object({
  retentionDays: z.number().int().min(1).max(3650),
});

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;
    verifyPathTenant(tenantId, req.headers.get("authorization"));
    const rows = await db
      .select()
      .from(auditRetentionPolicies)
      .where(eq(auditRetentionPolicies.tenantId, tenantId))
      .limit(1);
    if (!rows[0]) {
      return NextResponse.json({ retentionDays: 90 });
    }
    return NextResponse.json({ retentionDays: rows[0].retentionDays });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;
    verifyPathTenant(tenantId, req.headers.get("authorization"));
    const parsed = PutBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body" },
        { status: 400 },
      );
    }
    const updated = await db
      .insert(auditRetentionPolicies)
      .values({ tenantId, retentionDays: parsed.data.retentionDays })
      .onConflictDoUpdate({
        target: auditRetentionPolicies.tenantId,
        set: { retentionDays: parsed.data.retentionDays, updatedAt: new Date() },
      })
      .returning();
    return NextResponse.json({ retentionDays: updated[0]!.retentionDays });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}