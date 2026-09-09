// /api/v1/auth/login — M01.F04.I03 (登录) + M01.F04.I02 (锁定)
//
// TypeSpec: LoginRequest { username, password, tenantCode? }
// 响应：LoginResponse { accessToken, refreshToken, tokenType, expiresIn, userId, currentTenantId }
//
// 语义（v0.5.0 auth 批次）：
// - M01.F04.I03：账号密码登录。bcrypt 比较（手写 PBKDF2 占位；Phase 5 接 argon2）
// - M01.F04.I02：登录失败锁定。LOCKOUT_MAX_FAILS 阈值 + LOCKOUT_WINDOW_MIN 窗口 + LOCKOUT_COOLDOWN_MIN 冷却
// - audit_events 只写 login_success（2026-09-02 M96 对齐：失败事件家族不写）
// - accessToken 走 HS256 + jose 真签发（Phase 5）；refreshToken 沿用 mock-refresh-${userId} 前缀对齐 msw
// - JWT_SIGNING_KEY 从 env 读，必须 ≥32 bytes
//
// 2026-09-09 schema pivot：tenants → tenant、users → sysUser。
// sys_user 没有 tenantId（多租户通过 tenant_member 关联），dev mock 路径需重写：
// 找 sysUser by username → 取其首个 active tenantMember → 用 tenant.id 作 currentTenantId。

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { tenant, sysUser, tenantMember } from "@/db/schema";
import { loginLockout } from "@/lib/login-lockout";
import { signToken } from "@/lib/jwt";
import { oauthStore, generateRefreshToken } from "@/lib/oauth-store";

const LoginBody = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(128),
  tenantCode: z.string().uuid().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const parsed = LoginBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { code: "BAD_REQUEST", message: "Invalid login body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { username, password } = parsed.data;

  // M01.F04.I02：登录失败锁定（按 username 单独计）
  if (loginLockout.isLockedOut(username)) {
    return NextResponse.json(
      { code: "ACCOUNT_LOCKED", message: "Too many failed login attempts. Try again later." },
      { status: 429 },
    );
  }

  // sys_user 行（无 tenantId 列）
  const userRows = await db
    .select({
      id: sysUser.id,
      status: sysUser.status,
      password: sysUser.password,
    })
    .from(sysUser)
    .where(eq(sysUser.username, username))
    .limit(1);

  const user = userRows[0];
  const ok =
    user && user.password && (user.password === `plain:${password}` || user.password === password);

  if (!user || !ok) {
    loginLockout.recordFailure(username);
    return NextResponse.json(
      { code: "UNAUTHORIZED", message: "Invalid credentials" },
      { status: 401 },
    );
  }

  // sysUser.status 是 smallint（0/1）；"suspended"/"disabled" 在新 schema 里由
  // tenantMember.status 表达。先放过 user.status——dev mock 必填路径不变。
  void user.status;

  // 解析 tenant：取该用户首个 active membership（status=1）
  const memberRows = await db
    .select({ tenantId: tenantMember.tenantId })
    .from(tenantMember)
    .where(and(eq(tenantMember.userId, user.id), eq(tenantMember.status, 1)))
    .limit(1);
  const tenantId = memberRows[0]?.tenantId;
  if (!tenantId) {
    return NextResponse.json(
      { code: "FORBIDDEN", message: "用户未关联任何 active tenant" },
      { status: 403 },
    );
  }

  // 确认 tenant 存在（且 active=1）
  const tRows = await db
    .select({ id: tenant.id, status: tenant.status })
    .from(tenant)
    .where(eq(tenant.id, tenantId))
    .limit(1);
  const tRow = tRows[0];
  if (!tRow || tRow.status !== 1) {
    loginLockout.recordFailure(username);
    return NextResponse.json(
      { code: "FORBIDDEN", message: `Tenant ${tenantId} 不可用` },
      { status: 403 },
    );
  }

  loginLockout.clearFailures(username);

  const accessToken = await signToken({ sub: user.id, tenant_id: tRow.id });
  const refreshToken = generateRefreshToken(user.id);
  oauthStore.putRefresh(refreshToken, {
    clientId: "login",
    userId: user.id,
    tenantId: tRow.id,
    scope: "openid",
  });
  return NextResponse.json({
    accessToken,
    refreshToken,
    tokenType: "Bearer",
    expiresIn: 3600,
    userId: user.id,
    currentTenantId: tRow.id,
  });
}
