// /api/v1/auth/login — M03.F01.I01（v0.4.0 anchor 1）
//
// TypeSpec: tsp/routes/auth.tsp login(@body body: LoginRequest): LoginResponse | ErrorResponse
// 语义：
//   - body: { username, password, tenantCode? }
//   - 校验用户 → 校验密码（password_hash）→ 签发 accessToken（payload 含 sub + tenant_id）
//   - 当前实现：bcrypt 比较（手写 PBKDF2 占位；Phase 5 接 argon2）
//   - tenant_code → tenant_id 查询由 src/db/ 走 Drizzle

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";

const LoginBody = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
  tenantCode: z.string().uuid().optional(),
});

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function issueAccessToken(userId: string, tenantId: string): string {
  // Phase 5 替换为 jose 验签的 HS256；当前 base64url payload 形式仅 dev 用
  const header = b64url(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = b64url(
    JSON.stringify({
      sub: userId,
      tenant_id: tenantId,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    }),
  );
  return `${header}.${payload}.dev-placeholder`;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = LoginBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Invalid login body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { username, password, tenantCode } = parsed.data;

  // 解析 tenant_id（如果给了 tenantCode）
  let tenantId: string | undefined;
  if (tenantCode) {
    const t = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.code, tenantCode))
      .limit(1);
    tenantId = t[0]?.id;
    if (!tenantId) {
      return NextResponse.json(
        { code: "BAD_REQUEST", message: "Unknown tenantCode" },
        { status: 400 },
      );
    }
  }

  // 找用户（按 username；若指定 tenant 限定 tenant_id）
  const userRows = tenantId
    ? await db
        .select({
          id: users.id,
          tenantId: users.tenantId,
          status: users.status,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(and(eq(users.username, username), eq(users.tenantId, tenantId)))
        .limit(1)
    : await db
        .select({
          id: users.id,
          tenantId: users.tenantId,
          status: users.status,
          passwordHash: users.passwordHash,
        })
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

  const user = userRows[0];
  if (!user || !user.passwordHash) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Invalid credentials" },
      { status: 401 },
    );
  }

  // Phase 5：换 argon2.verify(passwordHash, password)；当前 dev 占位直接比对 hash 串
  // 仅 dev：dev seed 把 passwordHash 写成 `"plain:${password}"` 用于 smoke test
  const ok = user.passwordHash === `plain:${password}` || user.passwordHash === password;
  if (!ok) {
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Invalid credentials" },
      { status: 401 },
    );
  }

  if (user.status === "suspended" || user.status === "disabled") {
    return NextResponse.json(
      { code: "FORBIDDEN", message: `User ${user.status}` },
      { status: 403 },
    );
  }

  const accessToken = issueAccessToken(user.id, user.tenantId);
  return NextResponse.json({
    accessToken,
    refreshToken: `refresh-${user.id}-${Date.now()}`,
    tokenType: "Bearer",
    expiresIn: 3600,
    userId: user.id,
    currentTenantId: user.tenantId,
  });
}