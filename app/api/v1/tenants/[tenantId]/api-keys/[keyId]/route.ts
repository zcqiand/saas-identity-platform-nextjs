// /api/v1/tenants/:tenantId/api-keys/:keyId — M05.F01.I05 物理删除
//
// 区别于 I03 revoke 软删：直接 DELETE FROM 行，无审计事件。
// 与 I03 revoke 并存：revoke 保留行（status=revoked + revokedAt）；本 op 行消失。
// 幂等：重复删已不存在的 keyId 返 404 NOT_FOUND。

import { NextRequest, NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { apiKeys } from "@/db/schema";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

// @entry M05.F01.I05
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ tenantId: string; keyId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId, keyId } = await params;
    await verifyPathTenant(tenantId, _req.headers.get("authorization"));
    const deleted = await db
      .delete(apiKeys)
      .where(and(eq(apiKeys.tenantId, tenantId), eq(apiKeys.id, keyId)))
      .returning({ id: apiKeys.id });
    if (deleted.length === 0) {
      return NextResponse.json({ code: "NOT_FOUND", message: "Api key not found" }, { status: 404 });
    }
    // 不写 audit event（物理删不留痕；与 revoke 写 api_key_revoked 形成对照）
    return new NextResponse(null, { status: 204 });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}
