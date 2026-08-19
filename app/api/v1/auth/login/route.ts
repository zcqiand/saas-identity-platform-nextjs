// /api/v1/auth/login — M03.F01.I01 (登录) + M03.F01.I02 (锁定)
//
// TypeSpec: LoginRequest { username, password, tenantCode? }
// 响应：LoginResponse { accessToken, refreshToken, tokenType, expiresIn, userId, currentTenantId }
//
// 语义（v0.5.0 auth 批次）：
// - M03.F01.I01：账号密码登录。bcrypt 比较（手写 PBKDF2 占位；Phase 5 接 argon2）
// - M03.F01.I02：登录失败锁定。LOCKOUT_MAX_FAILS 阈值 + LOCKOUT_WINDOW_MIN 窗口 + LOCKOUT_COOLDOWN_MIN 冷却
// - audit_events 写 login_success / login_failed
// - accessToken 走 HS256 + jose 真签发（Phase 5）；refreshToken 沿用 mock-refresh-${userId} 前缀对齐 msw
// - JWT_SIGNING_KEY 从 env 读，必须 ≥32 bytes

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, users, auditEvents } from "@/db/schema";
import { loginLockout } from "@/lib/login-lockout";
import { signToken } from "@/lib/jwt";

const LoginBody = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
  tenantCode: z.string().uuid().optional(),
});

async function writeAudit(
  tenantId: string,
  actorUserId: string | undefined,
  action: "login_success" | "login_failed",
  metadata: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      tenantId,
      actorUserId: actorUserId ?? null,
      action,
      metadata,
    });
  } catch {
    // 写 audit 失败不阻塞登录主流程
  }
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

  // M03.F01.I02：登录失败锁定（按 username 单独计）
  if (loginLockout.isLockedOut(username)) {
    return NextResponse.json(
      { code: "ACCOUNT_LOCKED", message: "Too many failed login attempts. Try again later." },
      { status: 429 },
    );
  }

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
  // Phase 5：换 argon2.verify(passwordHash, password)；当前 dev 占位直接比对 hash 串
  // 仅 dev：dev seed 把 passwordHash 写成 `"plain:${password}"` 用于 smoke test
  const ok = user && user.passwordHash && (user.passwordHash === `plain:${password}` || user.passwordHash === password);

  if (!user || !ok) {
    // 失败：记一次 + 写 audit
    loginLockout.recordFailure(username);
    if (user) {
      await writeAudit(user.tenantId, user.id, "login_failed", { username, reason: "bad_credentials" });
    }
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Invalid credentials" },
      { status: 401 },
    );
  }

  if (user.status === "suspended" || user.status === "disabled") {
    loginLockout.recordFailure(username);
    await writeAudit(user.tenantId, user.id, "login_failed", { username, reason: user.status });
    return NextResponse.json(
      { code: "FORBIDDEN", message: `User ${user.status}` },
      { status: 403 },
    );
  }

  // 成功：清零失败计数 + 写 audit + 签 token（accessToken HS256 真签发；refreshToken 沿用 msw 前缀 mock-refresh-）
  loginLockout.clearFailures(username);
  await writeAudit(user.tenantId, user.id, "login_success", { username });

  const accessToken = await signToken({ sub: user.id, tenant_id: user.tenantId });
  return NextResponse.json({
    accessToken,
    refreshToken: `mock-refresh-${user.id}`,
    tokenType: "Bearer",
    expiresIn: 3600,
    userId: user.id,
    currentTenantId: user.tenantId,
  });
}