"use client";

import { use } from "react";
import { useTenantAuditListAuditEvents } from "@/api/endpoints/endpoints";

const AUDIT_ACTION_LABELS: Record<string, string> = {
  user_created: "创建用户",
  user_updated: "更新用户",
  user_deleted: "删除用户",
  login_success: "登录成功",
  login_failed: "登录失败",
  oauth_token_issued: "签发令牌",
  api_key_created: "创建 API Key",
  api_key_revoked: "吊销 API Key",
  role_assigned: "分配角色",
  role_revoked: "撤销角色",
};

export default function AuditListPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const list = useTenantAuditListAuditEvents(tenantId);
  const events = list.data?.data?.items ?? [];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>审计日志（M06.F01）— tenant {tenantId.slice(0, 8)}</h1>
        <button data-fn="M06.F01.I03" onClick={() => alert(`导出 CSV（M06.F01.I03）— 共 ${events.length} 条`)} style={{ padding: "6px 12px" }}>
          导出 CSV
        </button>
      </div>
      <p data-testid="loading" hidden={!list.isLoading}>加载中…</p>
      <table data-testid="audit-table" style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>时间</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>动作</th>
            <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid #ddd" }}>操作者</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} data-testid="audit-row">
              <td style={{ padding: 8 }}>{e.occurredAt}</td>
              <td style={{ padding: 8 }}>{AUDIT_ACTION_LABELS[e.action] ?? e.action}</td>
              <td style={{ padding: 8 }}>{e.actorUserId}</td>
            </tr>
          ))}
          {events.length === 0 && !list.isLoading && (
            <tr>
              <td colSpan={3} style={{ padding: 16, textAlign: "center", color: "#888" }} data-testid="empty">
                还没有审计事件
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}