// /api/v1/admin/clients/:clientId - M04/M08 单个应用（get + update + delete）
//
// TypeSpec: tsp/routes/admin-clients.tsp
//   getApp(@path clientId): App
//   updateApp(@path clientId, @body UpdateAppRequest): App
//   deleteApp(@path clientId): void (204)
// 语义：
//   - 平台级：await verifyPathTenant(null) 只要 JWT
//   - DELETE 级联清 sysMenu（FK ON DELETE CASCADE）
//   - UpdateAppRequest 不含 clientId（不可改）

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { oauthClient } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const GRANT_TYPES = [
  "authorization_code",
  "refresh_token",
  "client_credentials",
  "password",
] as const;

const UpdateAppBody = z.object({
  clientName: z.string().min(2).max(128).optional(),
  // 9/7 SSOT pivot：UpdateOAuthClientRequest 的 grantTypes / redirectUris / scopes
  // 全部是逗号分隔字符串，不是数组。
  redirectUris: z.string().optional(),
  scopes: z.string().optional(),
  grantTypes: z.string().optional(),
  autoApprove: z.boolean().optional(),
  accessTokenValidity: z.number().int().optional(),
  refreshTokenValidity: z.number().int().optional(),
  status: z.enum(["active", "disabled"]).optional(),
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

// /admin/clients/:clientId —— SSOT 寻址契约：path 上的 clientId 是 oauth_client.client_id
// 字符串列（非 oauth_client.id UUID）。9/7 pivot 后 family 统一走 clientId 列寻址，
// 与 springboot `findByClientId` / aspnetcore `ClientsGet(string clientId)` 对齐。
async function getAppByClientId(clientId: string) {
  const rows = await db
    .select(appFields)
    .from(oauthClient)
    .where(eq(oauthClient.clientId, clientId))
    .limit(1);
  return rows[0];
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { clientId } = await params;
    const app = await getAppByClientId(clientId);
    if (!app) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "App not found" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ...app, status: statusFromSmallint(app.status) });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { clientId } = await params;
    const parsed = UpdateAppBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const existing = await getAppByClientId(clientId);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "App not found" },
        { status: 404 },
      );
    }

    const { clientName, redirectUris, scopes, grantTypes, autoApprove, accessTokenValidity, refreshTokenValidity, status } = parsed.data;
    const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (clientName !== undefined) patch.clientName = clientName;
    // string 直传（已是 csv / 单串），不再 join
    if (redirectUris !== undefined) patch.redirectUris = redirectUris;
    if (scopes !== undefined) patch.scopes = scopes;
    if (grantTypes !== undefined) patch.grantTypes = grantTypes;
    if (autoApprove !== undefined) patch.autoApprove = autoApprove;
    if (accessTokenValidity !== undefined) patch.accessTokenValidity = accessTokenValidity;
    if (refreshTokenValidity !== undefined) patch.refreshTokenValidity = refreshTokenValidity;
    if (status !== undefined) patch.status = status === "active" ? 1 : 0;

    if (Object.keys(patch).length === 1) {
      return NextResponse.json({ ...existing, status: statusFromSmallint(existing.status) });
    }

    const [updated] = await db
      .update(oauthClient)
      .set(patch)
      .where(eq(oauthClient.clientId, clientId))
      .returning(appFields);
    if (!updated) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "App not found after update" },
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

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ clientId: string }> },
): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const { clientId } = await params;
    const existing = await getAppByClientId(clientId);
    if (!existing) {
      return NextResponse.json(
        { code: "NOT_FOUND", message: "App not found" },
        { status: 404 },
      );
    }
    await db.delete(oauthClient).where(eq(oauthClient.clientId, clientId));
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}
