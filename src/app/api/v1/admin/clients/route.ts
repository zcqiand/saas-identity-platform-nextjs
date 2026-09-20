// /api/v1/admin/clients - M04/M08 平台级应用管理（list + create）
//
// TypeSpec: tsp/routes/admin-clients.tsp
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
  // 5.59 A-1：删超契约 min/max 贴契约（CreateOAuthClientRequest.clientId 无约束；min1 保底，5.11 先例）
  clientId: z.string().min(1),
  // 5.59 A-1：删超契约 min/max 贴契约（CreateOAuthClientRequest.clientName 无约束；min1 保底）
  clientName: z.string().min(1),
  clientSecret: z.string().optional(),
  // 9/7 SSOT pivot：CreateOAuthClientRequest 的 grantTypes / redirectUris / scopes
  // 全部是逗号分隔字符串（DB 列是 varchar / text），不是数组。
  // 本地防御性收紧，超出 TSP 契约（5.59 C-3 人裁 2026-09-20 维持现状）
  redirectUris: z.string().min(1),
  scopes: z.string().optional(),
  // 本地防御性收紧，超出 TSP 契约（5.59 C-3 人裁 2026-09-20 维持现状）
  grantTypes: z.string().min(1),
  autoApprove: z.boolean().optional(),
  accessTokenValidity: z.number().int().optional(),
  refreshTokenValidity: z.number().int().optional(),
  status: z.union([z.literal(0), z.literal(1), z.enum(["active", "disabled"])]).optional(),
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

// status 落库归一化：接受 smallint 数字或字符串别名，统一转 smallint 存储/回传
function statusToSmallint(s: number | "active" | "disabled"): number {
  if (typeof s === "number") return s;
  return s === "active" ? 1 : 0;
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
    const totalResult = await db.select({ count: sql<number>`count(*)::int` }).from(oauthClient);
    const total = totalResult[0]?.count ?? 0;
    const items = await db
      .select(appFields)
      .from(oauthClient)
      .limit(pageSize)
      .offset(page * pageSize)
      .orderBy(sql`created_at DESC`);
    // status 直接透传 smallint 数字（契约/msw oracle 是数字，不再转 "active" 字符串）
    return NextResponse.json({
      items,
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
        // 已是 string（comma-separated / csv），不再 join
        grantTypes: b.grantTypes,
        redirectUris: b.redirectUris,
        scopes: b.scopes ?? null,
        autoApprove: b.autoApprove ?? false,
        accessTokenValidity: b.accessTokenValidity ?? 3600,
        refreshTokenValidity: b.refreshTokenValidity ?? 86400,
        status: b.status === undefined ? 1 : statusToSmallint(b.status),
      })
      .returning(appFields);
    if (!created) {
      return NextResponse.json(
        { code: "INTERNAL", message: "Client creation returned no row" },
        { status: 500 },
      );
    }
    // status 透传 smallint 数字（契约对齐 msw oracle）
    return NextResponse.json(created);
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
