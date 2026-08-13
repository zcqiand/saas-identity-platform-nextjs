// /api/v1/auth/logout — M03.F03.I05
//
// TypeSpec: tsp/routes/auth.tsp logout(): void
// 语义：清理本地 session；JWT 校验已在 JWT bearer 中间件层完成（无 Authorization 时返回 401）。
// Phase 5：仅返回 204，不维护 server-side session store（无状态 JWT）。

import { NextRequest, NextResponse } from "next/server";
import { claimsFromAuthHeader } from "@/lib/jwt";

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 即便 token 无效也返回 204（防止泄露 token 状态信息）
  claimsFromAuthHeader(req.headers.get("authorization"));
  return new NextResponse(null, { status: 204 });
}