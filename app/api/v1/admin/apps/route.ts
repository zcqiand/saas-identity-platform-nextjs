// /api/v1/admin/apps - M04/M08 平台级应用管理（list + create）
//
// TypeSpec: tsp/routes/admin-apps.tsp
//   listApps(@query page?, @query pageSize?): Page<App>
//   createApp(@body CreateAppRequest): App
// 语义：
//   - 平台级（不 tenant-scoped）：await verifyPathTenant(null) 只要 JWT
//   - GET -> Page<App>（sort_order ASC, created_at DESC）
//   - POST -> App；code / clientId 平台唯一，冲突 409
//   - clientSecret 入库为 client_secret_hash（dev 占位）；响应不返回明文

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
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
  code: z.string().min(2).max(64),
  name: z.string().min(2).max(255),
  description: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().int().optional(),
  status: z.enum(["active", "disabled"]).optional(),
  clientId: z.string().min(2).max(128),
  clientSecret: z.string().optional(),
  redirectUris: z.array(z.string()).default([]),
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
      .from(apps);
    const total = totalResult[0]?.count ?? 0;
    const items = await db
      .select(appFields)
      .from(apps)
      .limit(pageSize)
      .offset(page * pageSize)
      .orderBy(sql`sort_order ASC, created_at DESC`);
    return NextResponse.json({ items, page, pageSize, total });
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
      .insert(apps)
      .values({
        code: b.code,
        name: b.name,
        description: b.description ?? null,
        icon: b.icon ?? null,
        sortOrder: b.sortOrder ?? 0,
        status: b.status ?? "active",
        clientId: b.clientId,
        clientSecretHash: b.clientSecret ? `plain:${b.clientSecret}` : "dev-placeholder-hash",
        redirectUris: b.redirectUris,
        scopes: b.scopes ?? [],
        grantTypes: b.grantTypes ?? [],
        isFirstParty: b.isFirstParty ?? false,
      })
      .returning(appFields);
    return NextResponse.json(created);
  } catch (e) {
    const guardResp = tenantGuardErrorToNextResponse(e);
    if (guardResp) return guardResp;
    if ((e as { code?: string })?.code === "23505") {
      return NextResponse.json(
        { code: "CONFLICT", message: "App code or clientId already exists" },
        { status: 409 },
      );
    }
    throw e;
  }
}
