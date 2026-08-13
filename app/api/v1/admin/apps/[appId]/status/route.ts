// /api/v1/admin/apps/glm_5.2_ark_toC/status - M04.F02.I06 启用/停用
//
// TypeSpec: tsp/routes/admin-apps.tsp
//   setAppStatus(@path appId, @body { status: AppStatus }): App

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const StatusBody = z.object({
  status: z.enum(["active", "disabled"]),
});

const appFields = {
  id: apps.id,
  code: apps.code,
  name: apps.name,
  description: apps.description,
  icon: apps.icon,
  sortOrder: apps.sortOrder,
  status: apps.status,
  clientId: apps.clientId,
  redirectUris: apps.redirectUris,
  scopes: apps.scopes,
  grantTypes: apps.grantTypes,
  isFirstParty: apps.isFirstParty,
  createdAt: apps.createdAt,
  updatedAt: apps.updatedAt,
};

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
): Promise<NextResponse> {
  try {
    verifyPathTenant(null, req.headers.get("authorization"));
    const { appId } = await params;
    const parsed = StatusBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const [updated] = await db
      .update(apps)
      .set({ status: parsed.data.status })
      .where(eq(apps.id, appId))
      .returning(appFields);
    if (!updated) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "App not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(updated);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
