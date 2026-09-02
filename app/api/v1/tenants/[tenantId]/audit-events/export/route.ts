// /api/v1/tenants/:tenantId/audit-events/export — M06.F01.I03
//
// TypeSpec: tsp/routes/tenant-audit.tsp exportAuditEvents(@body { from, to, format }): { downloadUrl }
// Phase 5 占位（与 springboot TenantAuditController / aspnetcore TenantAuditController 对齐）：
// 返回 example.com 占位 URL，不做真实文件导出。
// 2026-09-01 contract-test I58：此前目录存在但 route.ts 缺失 → 404 HTML，SSOT 有实现缺。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyPathTenant, tenantGuardErrorToNextResponse } from "@/lib/tenant-guard";

const Body = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  format: z.enum(["csv", "json"]),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tenantId: string }> },
): Promise<NextResponse> {
  try {
    const { tenantId } = await params;
    await verifyPathTenant(tenantId, req.headers.get("authorization"));
    const parsed = Body.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Invalid body" },
        { status: 400 },
      );
    }
    const url = `https://example.com/audit-export-${tenantId}-${Date.now()}.${parsed.data.format}`;
    return NextResponse.json({ downloadUrl: url });
  } catch (e) {
    const g = tenantGuardErrorToNextResponse(e);
    if (g) return g;
    throw e;
  }
}
