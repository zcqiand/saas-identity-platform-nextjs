// /api/v1/tenants/:tenantId/api-keys/:keyId/rotate — M05.F01.I04
//
// 轮换：revoke 旧 key + 创建新 key（同名，同 scopes）
// 返回新 CreateApiKeyResponse（含 secret 明文）

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; keyId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, keyId } = await params;
    verifyPathTenant(tenantId, req.headers.get("authorization"));
    // 找旧 key
    const oldRows = await db
      .select()
      .from(apiKeys)
      .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.id, keyId)))
      .limit(1);
    const old = oldRows[0];
    if (!old) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Api key not found" }, { status: 404 });
    }
    // 标记旧 key revoked
    await db
      .update(apiKeys)
      .set({ status: "revoked", revokedAt: new Date() })
      .where(eq(apiKeys.id, keyId));
    // 创建新 key
    const prefix = randomBytes(4).toString("hex").slice(0, 8);
    const secret = `sk_${randomBytes(32).toString("hex")}`;
    const inserted = await db
      .insert(apiKeys)
      .values({
        tenantId,
        name: old.name,
        prefix,
        secretHash: `plain:${secret}`,
        scopes: old.scopes,
        expiresAt: old.expiresAt,
      })
      .returning();
    const k = inserted[0]!;
    return NextResponse.json(
      {
        apiKey: {
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
        },
        secret,
      },
      { status: 201 },
    );
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}