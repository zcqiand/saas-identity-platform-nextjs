// /api/v1/admin/apps - M04/M08 平台级应用管理（list + create）
//
// TypeSpec: tsp/routes/admin-apps.tsp
//   listApps(@query page?, @query pageSize?): Page<App>
//   createApp(@body CreateAppRequest): App
// 语义：
//   - 平台级（不 tenant-scoped）：await verifyPathTenant(null) 只要 JWT
//   - GET -> Page<App>（clientId ASC, created_at DESC）
//   - POST -> App；clientId 平台唯一，冲突 409
//   - clientSecret 入库为 clientSecret（明文占位）；响应不返回明文
//
// 2026-09-09 schema pivot：apps → oauthClient。
// oauth_client 列：clientId, clientSecret, clientName, grantTypes (varchar), redirectUris (text),
//                   scopes, accessTokenValidity, refreshTokenValidity, autoApprove, status (smallint)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { oauthClient } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const PAGE_DEFAULT = 20;
const PAGE_MAX = 100;

const GRANT_TYPES = [
  "authorization_code",
  "refresh_token",
  "client_credentials",
  "password",
] as const;

const CreateAppBody = z.object({
  clientId: z.string().min(2).max(128),
  clientName: z.string().min(2).max(128),
  clientSecret: z.string().optional(),
  redirectUris: z.array(z.string()).default([]),
  scopes: z.array(z.string()).optional(),
  grantTypes: z.array(z.enum(GRANT_TYPES)).optional(),
  autoApprove: z.boolean().optional(),
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const url = new URL(req.url);
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const pageSize = Math.min(
      PAGE_MAX,
      Math.max(1, Number(url.searchParams.get("pageSize") ?? PAGE_DEFAULT)),
    );
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(oauthClient);
    const total = totalResult[0]?.count ?? 0;
    const items = await db
      .select(appFields)
      .from(oauthClient)
      .limit(pageSize)
      .offset(page * pageSize)
      .orderBy(sql`created_at DESC`);
    return NextResponse.json({
      items: items.map((c) => ({ ...c, status: statusFromSmallint(c.status) })),
      page,
      pageSize,
      total,
    });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    throw e;
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    await verifyPathTenant(null, req.headers.get("authorization"));
    const parsed = CreateAppBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const b = parsed.data;
    const [created] = await db
      .insert(oauthClient)
      .values({
        clientId: b.clientId,
        clientName: b.clientName,
        clientSecret: b.clientSecret ? `plain:${b.clientSecret}` : "dev-placeholder-hash",
        grantTypes: (b.grantTypes ?? []).join(","),
        redirectUris: (b.redirectUris ?? []).join("\n"),
        scopes: (b.scopes ?? []).join(","),
        autoApprove: b.autoApprove ?? false,
        status: b.status === "disabled" ? 0 : 1,
      })
      .returning(appFields);
    if (!created) {
      return NextResponse.json(
        { code: "INTERNAL", message: "Client creation returned no row" },
        { status: 500 },
      );
    }
    return NextResponse.json({ ...created, status: statusFromSmallint(created.status) });
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    if ((e as { code?: string })?.code === "23505") {
      return NextResponse.json(
        { code: "CONFLICT", message: "ClientId already exists" },
        { status: 409 },
      );
    }
    throw e;
  }
}
