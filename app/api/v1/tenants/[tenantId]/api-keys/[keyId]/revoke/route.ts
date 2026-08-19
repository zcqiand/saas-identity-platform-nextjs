// /api/v1/tenants/:tenantId/api-keys/:keyId/revoke — M05.F01.I03

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; keyId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, keyId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const updated = await db
      .update(apiKeys)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.id, keyId)))
      .returning();
    const k = updated[0];
    if (!k) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Api key not found" }, { status: 404 });
    }
    return NextResponse.json({
      id: k.id,
      tenantId: k.tenantId,
      name: k.name,
      prefix: k.prefix,
      status: k.status,
      scopes: k.scopes,
      createdAt: k.createdAt.toISOString(),
      lastUsedAt: k.lastUsedAt?.toISOString(),
      expiresAt: k.expiresAt?.toISOString(),
      revokedAt: k.revokedAt?.toISOString(),
    });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}