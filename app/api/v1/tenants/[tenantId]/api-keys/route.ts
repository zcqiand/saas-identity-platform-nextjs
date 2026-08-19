// /api/v1/tenants/:tenantId/api-keys — M05.F01 列表/创建
//
// TypeSpec: tsp/routes/tenant-api-keys.tsp listApiKeys / createApiKey
// GET / POST

import { NextRequest, NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";
import { randomBytes } from "node:crypto";

const CreateApiKeyBody = z.object({
  name: z.string().min(2).max(128),
  scopes: z.array(z.string()).optional(),
  expiresAt: z.string().datetime().optional(),
});

function toDto(k: typeof apiKeys.$inferSelect) {
  return {
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
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const url = new URL(req.url);
    const page = Math.max(0, Number(url.searchParams.get("page") ?? 0));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));
    const totalResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, tenantId));
    const total = totalResult[0]?.count ?? 0;
    const items = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.tenantId, tenantId))
      .limit(pageSize)
      .offset(page * pageSize)
      .orderBy(sql`created_at DESC`);
    return NextResponse.json({ items: items.map(toDto), page, pageSize, total });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const parsed = CreateApiKeyBody.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body" },
        { status: 400 },
      );
    }
    // 生成 8 字符 prefix + 32 字节 secret（仅返回一次）
    const prefix = randomBytes(4).toString("hex").slice(0, 8);
    const secret = `sk_${randomBytes(32).toString("hex")}`;
    const secretHash = `plain:${secret}`;  // Phase 5：明文占位；正式 argon2
    const inserted = await db
      .insert(apiKeys)
      .values({
        tenantId,
        name: parsed.data.name,
        prefix,
        secretHash,
        scopes: parsed.data.scopes ?? [],
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : undefined,
      })
      .returning();
    const k = inserted[0]!;
    return NextResponse.json(
      { apiKey: toDto(k), secret },
      { status: 201 },
    );
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}