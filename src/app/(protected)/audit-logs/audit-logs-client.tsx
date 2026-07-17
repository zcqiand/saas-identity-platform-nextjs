"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Tab = "all" | "login" | "operation" | "security";

/**
 * M05.F01 审计日志查看（client）
 *
 * fn-ID 覆盖：
 *   - I01 审计日志页面 → data-testid="audit-logs-page" data-fn="M05.F01.I01"
 *   - I02 全部 Tab → data-testid="audit-tab-all" data-fn="M05.F01.I02"
 *   - I03 登录日志 Tab → data-testid="audit-tab-login" data-fn="M05.F01.I03"
 *   - I04 操作日志 Tab → data-testid="audit-tab-operation" data-fn="M05.F01.I04"
 *   - I05 安全日志 Tab → data-testid="audit-tab-security" data-fn="M05.F01.I05"
 *   - I06 日志查询筛选 → operator 搜索框 data-fn="M05.F01.I06"
 *   - I07 导出 CSV → 顶部按钮 data-fn="M05.F01.I07" 调 POST /api/audit-logs 下载
 */
export interface AuditLogRow extends Record<string, unknown> {
  id: number;
  action: string;
  operator: string;
  resource: string;
  resourceId: string;
  ip: string;
  detail: string;
  timestamp: string;
}

export interface AuditLogsClientProps {
  initialLogs: AuditLogRow[];
}

const TAB_LABELS: Record<Tab, string> = {
  all: "全部",
  login: "登录日志",
  operation: "操作日志",
  security: "安全日志",
};

export function AuditLogsClient({ initialLogs }: AuditLogsClientProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [operator, setOperator] = useState("");
  const [logs, setLogs] = useState<AuditLogRow[]>(initialLogs);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  async function load(forTab: Tab, forOperator: string) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ tab: forTab });
      if (forOperator) params.set("operator", forOperator);
      const res = await fetch(`/api/audit-logs?${params.toString()}`);
      if (!res.ok) {
        toast.error(`查询失败 (${res.status})`);
        return;
      }
      const data = (await res.json()) as AuditLogRow[];
      setLogs(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setLoading(false);
    }
  }

  // tab 或 operator 变化时自动 load
  useEffect(() => {
    void load(tab, operator);
  }, [tab, operator]);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch("/api/audit-logs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tab, operator: operator || undefined }),
      });
      if (!res.ok) {
        toast.error(`导出失败 (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `audit-${tab}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("CSV 已开始下载");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "网络错误");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div
      data-testid="audit-logs-page"
      data-fn="M05.F01.I01"
      className="container mx-auto space-y-6 py-8"
    >
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle>审计日志</CardTitle>
          <Button
            data-testid="export-audit-csv-btn"
            data-fn="M05.F01.I07"
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
          >
            {exporting ? "导出中..." : "导出 CSV"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <Button
                key={t}
                data-testid={`audit-tab-${t}`}
                data-fn={`M05.F01.I0${
                  t === "all" ? "2" : t === "login" ? "3" : t === "operation" ? "4" : "5"
                }`}
                size="sm"
                variant={tab === t ? "default" : "outline"}
                onClick={() => {
                  setTab(t);
                }}
              >
                {TAB_LABELS[t]}
              </Button>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              data-testid="audit-operator-search"
              data-fn="M05.F01.I06"
              placeholder="按 operator 过滤（留空=全部）"
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
            />
            <Button onClick={() => void load(tab, operator)} disabled={loading} variant="outline">
              {loading ? "查询中..." : "查询"}
            </Button>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>时间</TableHead>
                <TableHead>操作</TableHead>
                <TableHead>操作人</TableHead>
                <TableHead>资源</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>详情</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((l) => (
                <TableRow key={l.id} data-testid="audit-log-row">
                  <TableCell className="text-muted-foreground text-xs">
                    {l.timestamp}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{l.action}</TableCell>
                  <TableCell>{l.operator}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {l.resource}#{l.resourceId}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">{l.ip}</TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {l.detail || "—"}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-muted-foreground text-center text-sm">
                    暂无日志
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}