/**
 * M03.F02.I03 - GET /api/auth/permissions
 *
 * client 拿 SSO token 换权限集。lab 仓的 sso-callback 在换到 token 后立即调此端点
 * 拿完整角色/权限集，写入 lab_session cookie 的 payload（避免 lab 端再回查 saas）。
 *
 * Header：Authorization: Bearer <sso-jwt>（必填）
 * Query：departmentId（必填，按 1:1 决策只接 org-lab-root）
 *   注：v0.3.0 重命名 orgId → departmentId；仍兼容旧 orgId 查询参数
 *
 * 响应：{ roles: [{id, name, permissions}], permissions: string[] }
 */
import { NextResponse } from "next/server";
import { verifySsoToken, type SsoPayload } from "@/lib/sso-jwt";
import { LAB_ROLES, LAB_DEPARTMENT_ROOT_ID } from "@/lib/lab-seed";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(.+)$/.exec(auth);
  if (!m || !m[1]) {
    return NextResponse.json({ message: "未授权" }, { status: 401 });
  }

  const payload: SsoPayload | null = await verifySsoToken(m[1]);
  if (!payload) {
    return NextResponse.json({ message: "无效或过期 token" }, { status: 401 });
  }

  const url = new URL(req.url);
  // v0.3.0 重命名过渡：departmentId 优先，旧 orgId 兼容
  const departmentId = url.searchParams.get("departmentId") ?? url.searchParams.get("orgId") ?? "";

  // 仅支持 lab 仓（org-lab-root 1:1 对应 tenant-lab）
  if (departmentId !== LAB_DEPARTMENT_ROOT_ID) {
    return NextResponse.json({ message: "未注册的 departmentId" }, { status: 403 });
  }

  // 从 token 的 roles 字段查 lab 角色定义
  const roleDefs = payload.roles
    .map((id) => LAB_ROLES.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => r !== undefined);

  // 兼容：mock 模式下 token 已含 permissions，但 lab 端可能想拿完整角色列表
  const roles = roleDefs.map((r) => ({
    id: r.id,
    name: r.name,
    permissions: [...r.permissions],
  }));

  return NextResponse.json({
    roles,
    permissions: payload.permissions,
  });
}
