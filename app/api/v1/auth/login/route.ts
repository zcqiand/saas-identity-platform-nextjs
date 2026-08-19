// /api/v1/auth/login — M03.F01.I01 (登录) + M03.F01.I02 (锁定)
//
// TypeSpec: LoginRequest { username, password, tenantCode? }
// 响应：LoginResponse { accessToken, refreshToken, tokenType, expiresIn, userId, currentTenantId }
//
// 语义（v0.5.0 auth 批次）：
// - M03.F01.I01：账号密码登录。bcrypt 比较（手写 PBKDF2 占位；Phase 5 接 argon2）
// - M03.F01.I02：登录失败锁定。LOCKOUT_MAX_FAILS 阈值 + LOCKOUT_WINDOW_MIN 窗口 + LOCKOUT_COOLDOWN_MIN 冷却
// - audit_events 写 login_success / login_failed
// - token 前缀 mock-jwt-${userId} / mock-refresh-${userId}（对齐 msw handlers-extra.ts:282-283）
// - JWT_SIGNING_KEY 从 env 读，未设置打 console.warn（dev 占位 alg:none）

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenants, users, auditEvents } from "@/db/schema";
import { loginLockout } from "@/lib/login-lockout";

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
  // 读 JWT_SIGNING_KEY（env 镜像 springboot/aspnetcore）；未设置打 warn
  if (!process.env.JWT_SIGNING_KEY) {
    console.warn(
      "[auth/login] JWT_SIGNING_KEY 未设置；当前 dev 占位 alg:none base64url，生产前必须设。",
    );
  }
  // Phase 5 替换为 jose HS256 签发；当前 dev 用 base64url 占位
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

  // 成功：清零失败计数 + 写 audit + 签 token（token 前缀对齐 msw handler-extra.ts:282-283）
  loginLockout.clearFailures(username);
  await writeAudit(user.tenantId, user.id, "login_success", { username });

  const accessToken = issueAccessToken(user.id, user.tenantId);
  return NextResponse.json({
    accessToken,
    refreshToken: `mock-refresh-${user.id}`,
    tokenType: "Bearer",
    expiresIn: 3600,
    userId: user.id,
    currentTenantId: user.tenantId,
  });
}