// M06.F03.I01 审计写入助手 — nextjs 写端点副作用。
// 抽出 auth/login 与 oauth/token 内联的 writeAudit 模式（两个本地副本）
// 收敛到 src/lib/audit.ts，供 api-keys POST/revoke 等所有写端点复用。
//
// 形状（与 msw / aspnetcore / springboot 对齐）：
// { tenantId, actorUserId(从 JWT sub), action, targetUserId=null, metadata={...} }
//
// 失败语义：审计是 best-effort，写失败不阻断主业务；catch 内 swallow。
// 参照 msw handlers-extra writeAudit 的同款策略（ADR 不分摊 volatile 字段）。

import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { decodeJwtPayload } from "@/lib/jwt";

export type AuditAction =
  | "user_created"
  | "user_updated"
  | "user_deleted"
  | "role_assigned"
  | "role_revoked"
  | "login_success"
  | "login_failed"
  | "oauth_token_issued"
  | "api_key_created"
  | "api_key_revoked";

/** 从 Bearer token 解析 actorUserId；解析失败返回 null（系统动作 / 未鉴权）。 */
function actorFromAuthHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  const m = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!m) return null;
  try {
    const claims = decodeJwtPayload(m[1]!);
    const sub = (claims as { sub?: unknown }).sub;
    return typeof sub === "string" ? sub : null;
  } catch {
    return null;
  }
}

export async function writeAudit(args: {
  tenantId: string;
  authHeader: string | null;
  action: AuditAction;
  metadata: Record<string, unknown>;
}): Promise<void> {
  try {
    await db.insert(auditEvents).values({
      tenantId: args.tenantId,
      actorUserId: actorFromAuthHeader(args.authHeader),
      action: args.action,
      metadata: args.metadata,
    });
  } catch {
    // best-effort；与 msw handlers-extra writeAudit 一致
  }
}
