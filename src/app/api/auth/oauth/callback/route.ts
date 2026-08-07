/**
 * M03.F02.I02 - POST /api/auth/oauth/callback
 *
 * OAuth 授权码换 token 端点。client（lab 仓 sso-callback）POST { code, clientId }，
 * saas 端校验 code 后签发 SSO JWT 并返回 { token, user }。
 *
 * mock 模式（code === 'bad-code' → 401；其他任何非空 code 通过）：
 *   - clientId='lab-management' → 签发 labadmin 身份 token（含 lab 业务权限全集）
 *   - 其他 clientId → 401（mock 阶段不签发其他租户 token；prod 走真实 OAuth 注册流）
 *
 * 注意：本路由不写任何 cookie（OAuth 2.0 RFC 6749 §4.1.4：返回 token 由 client 决定存法）。
 *   lab 仓的 sso-callback 拿到 token 后自行签 lab_session cookie。
 */
import { NextResponse } from "next/server";
import { signSsoToken } from "@/lib/sso-jwt";
import { LAB_ROLES, LAB_USERS, APP_LAB_ID } from "@/lib/lab-seed";

interface CallbackBody {
  code?: unknown;
  clientId?: unknown;
}

export async function POST(req: Request) {
  let body: CallbackBody;
  try {
    body = (await req.json()) as CallbackBody;
  } catch {
    return NextResponse.json({ message: "无效请求体" }, { status: 400 });
  }

  const code = typeof body.code === "string" ? body.code : "";
  const clientId = typeof body.clientId === "string" ? body.clientId : "";

  if (!code) {
    return NextResponse.json({ message: "缺少 code" }, { status: 400 });
  }

  // mock 模式：bad-code 显式拒
  if (code === "bad-code") {
    return NextResponse.json({ message: "无效授权码" }, { status: 401 });
  }

  // 仅签发 lab 仓的 token（其他 clientId 视为未注册）
  if (clientId !== "lab-management") {
    return NextResponse.json({ message: "未注册的 clientId" }, { status: 401 });
  }

  // mock：固定选 labadmin 作为登录用户（prod 走真实用户登录态）
  const user = LAB_USERS.find((u) => u.username === "labadmin");
  if (!user) {
    return NextResponse.json({ message: "lab 用户未配置" }, { status: 500 });
  }

  const role = LAB_ROLES.find((r) => r.id === user.roleId);
  if (!role) {
    return NextResponse.json({ message: "lab 角色未配置" }, { status: 500 });
  }

  const token = await signSsoToken({
    sub: user.id,
    username: user.username,
    displayName: user.displayName,
    departmentId: user.orgId,
    tenantId: user.tenantId,
    appId: APP_LAB_ID,
    roles: [role.id],
    permissions: [...role.permissions],
  });

  return NextResponse.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      departmentId: user.orgId,
      // v0.3.0 重命名过渡：仍回传旧 orgId 字段以兼容 lab 端
      orgId: user.orgId,
      tenantId: user.tenantId,
    },
  });
}
