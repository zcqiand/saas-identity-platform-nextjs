// /api/v1/admin/apps/glm_5.2_ark_toC - M04/M08 单个应用（get + update + delete）
//
// TypeSpec: tsp/routes/admin-apps.tsp
//   getApp(@path appId): App
//   updateApp(@path appId, @body UpdateAppRequest): App
//   deleteApp(@path appId): void (204)
// 语义：
//   - 平台级：verifyPathTenant(null) 只要 JWT
//   - DELETE 级联清 menus（FK ON DELETE CASCADE）
//   - UpdateAppRequest 不含 code/clientId（不可改）

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const GRANT_TYPES = [
  "authorization_code",
  "refresh_token",
  "client_credentials",
  "password",
] as const;

const UpdateAppBody = z.object({
  name: z.string().min(2).max(255).optional(),
  description: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["active", "disabled"]).optional(),
  redirectUris: z.array(z.string()).optional(),
  scopes: z.array(z.string()).optional(),
  grantTypes: z.array(z.enum(GRANT_TYPES)).optional(),
  isFirstParty: z.boolean().optional(),
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

async function getAppById(id: string) {
  const rows = await db
    .select(appFields)
    .from(apps)
    .where(eq(apps.id, id))
    .limit(1);
  return rows[0];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
): Promise<NextResponse> {
  try {
    verifyPathTenant(null, req.headers.get("authorization"));
    const { appId } = await params;
    const app = await getAppById(appId);
    if (!app) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "App not found" },
        { status: 404 },
      );
    }
    return NextResponse.json(app);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
): Promise<NextResponse> {
  try {
    verifyPathTenant(null, req.headers.get("authorization"));
    const { appId } = await params;
    const parsed = UpdateAppBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const existing = await getAppById(appId);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "App not found" },
        { status: 404 },
      );
    }

    const { name, description, icon, sortOrder, status, redirectUris, scopes, grantTypes, isFirstParty } = parsed.data;
    const patch: Record<string, unknown> = {};
    if (name !== undefined) patch.name = name;
    if (description !== undefined) patch.description = description;
    if (icon !== undefined) patch.icon = icon;
    if (sortOrder !== undefined) patch.sortOrder = sortOrder;
    if (status !== undefined) patch.status = status;
    if (redirectUris !== undefined) patch.redirectUris = redirectUris;
    if (scopes !== undefined) patch.scopes = scopes;
    if (grantTypes !== undefined) patch.grantTypes = grantTypes;
    if (isFirstParty !== undefined) patch.isFirstParty = isFirstParty;

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(existing);
    }

    const [updated] = await db
      .update(apps)
      .set(patch)
      .where(eq(apps.id, appId))
      .returning(appFields);
    return NextResponse.json(updated);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ appId: string }> },
): Promise<NextResponse> {
  try {
    verifyPathTenant(null, req.headers.get("authorization"));
    const { appId } = await params;
    const existing = await getAppById(appId);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "App not found" },
        { status: 404 },
      );
    }
    await db.delete(apps).where(eq(apps.id, appId));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
