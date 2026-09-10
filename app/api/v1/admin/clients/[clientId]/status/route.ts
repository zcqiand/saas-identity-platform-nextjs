// /api/v1/admin/clients/:clientId/status - M04.F02.I01 启用/停用
//
// TypeSpec: tsp/routes/admin-clients.tsp
//   setAppStatus(@path clientId, @body { status: AppStatus }): App

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthClient } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const StatusBody = z.object({
  status: z.enum(["active", "disabled"]),
});

const appFields = {
  id: oauthClient.id,
  clientId: oauthClient.clientId,
  clientName: oauthClient.clientName,
  grantTypes: oauthClient.grantTypes,
  redirectUris: oauthClient.redirectUris,
  scopes: oauthClient.scopes,
  accessTokenValidity: oauthClient.accessTokenValidity,
  refreshTokenValidity: oauthClient.refreshTokenValidity,
  autoApprove: oauthClient.autoApprove,
  status: oauthClient.status,
  createdAt: oauthClient.createdAt,
  updatedAt: oauthClient.updatedAt,
};

function statusFromSmallint(n: number): "active" | "disabled" {
  return n === 1 ? "active" : "disabled";
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { clientId } = await params;
    const parsed = StatusBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const [updated] = await db
      .update(oauthClient)
      .set({ status: parsed.data.status === "active" ? 1 : 0, updatedAt: new Date().toISOString() })
      .where(eq(oauthClient.clientId, clientId))
      .returning(appFields);
    if (!updated) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "App not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ...updated, status: statusFromSmallint(updated.status) });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
