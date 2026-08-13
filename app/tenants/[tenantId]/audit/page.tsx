"use client";

// M06.F01 — tenant-scoped 审计日志（只读）

import { use } from "react";
import { useTenantAuditListAuditEvents } from "@/api/endpoints/endpoints";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "sonner";
import { getTenant } from "@saas/identity-platform-msw";

const ACTION_LABEL: Record<string, string> = {
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

const ACTION_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  user_created: "default",
  user_updated: "outline",
  login_success: "default",
  login_failed: "outline",
  api_key_created: "default",
  api_key_revoked: "secondary",
  role_assigned: "outline",
  role_revoked: "secondary",
};

export default function AuditListPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = use(params);
  const tenant = tenantId ? getTenant(tenantId) ?? null : null;
  const tenantLabel = tenant ? `租户 ${tenant.name}（${tenant.code}）` : "租户未知";
  const q = useTenantAuditListAuditEvents(tenantId);
  const events = q.data?.data?.items ?? [];

  function exportCsv() {
    // M06.F01.I03 — 由后端生成 CSV，前端只触发下载链接（实际链接由 msw handler 返）
    toast.success(`导出 CSV（M06.F01.I03）— 共 ${events.length} 条`);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="审计日志"
        description={`${tenantLabel} 的操作事件流`}
        actions={
          <Button data-fn="M06.F01.I03" onClick={exportCsv}>
            导出 CSV
          </Button>
        }
      />
      <Card>
        <CardHeader>
          <CardTitle>事件 ({events.length})</CardTitle>
        </CardHeader>
        <CardContent className="px-0">
          <div className="p-8 text-center text-sm text-slate-400" hidden={!q.isLoading}>
            加载中…
          </div>
          <div
            className="p-8 text-center text-sm text-slate-400"
            hidden={!((!q.data || !events.length) && !q.isLoading)}
          >
            暂无审计事件
          </div>
          <Table hidden={!events.length}>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>动作</TableHead>
                <TableHead>操作者</TableHead>
                <TableHead>目标</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="text-slate-500 tabular-nums">
                    {new Date(e.occurredAt).toLocaleString("zh-CN")}
                  </TableCell>
                  <TableCell>
                    <Badge variant={ACTION_VARIANT[e.action] ?? "outline"}>
                      {ACTION_LABEL[e.action] ?? e.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.actorUserId?.slice(-12) ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {e.targetUserId?.slice(-12) ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
