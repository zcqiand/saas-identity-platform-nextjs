import { NextResponse } from "next/server";
import * as auditStore from "@/lib/audit-store";

/** M05.F01 审计日志查询 / 导出 route handlers */

const TAB_TO_ACTIONS: Record<string, string[]> = {
  all: [],
  login: ["login", "logout"],
  operation: ["create", "update", "delete"],
  security: ["permission_change"],
};

export async function GET(req?: Request) {
  let tab = "all";
  let operator: string | undefined;
  if (req) {
    const u = new URL(req.url);
    const tabParam = u.searchParams.get("tab");
    if (tabParam && tabParam in TAB_TO_ACTIONS) tab = tabParam;
    const opParam = u.searchParams.get("operator");
    if (opParam) operator = opParam;
  }
  let logs: ReturnType<typeof auditStore.listAuditLogs>;
  if (tab === "all") {
    logs = auditStore.listAuditLogs(operator ? { operator } : undefined);
  } else {
    const allowed = TAB_TO_ACTIONS[tab]!;
    logs = auditStore
      .listAuditLogs(operator ? { operator } : undefined)
      .filter((l) => allowed.includes(l.action));
  }
  return NextResponse.json(logs);
}

export async function POST(req: Request) {
  // /api/audit-logs POST：导出当前 tab 为 CSV。POST 是因为 export 是动作语义（无副作用，但 GET 带 side-effect query 不规范）。
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (raw === null || typeof raw !== "object") {
    return NextResponse.json({ error: "body must be object" }, { status: 400 });
  }
  const b = raw as { tab?: unknown; operator?: unknown };
  const tab =
    typeof b.tab === "string" && b.tab in TAB_TO_ACTIONS ? b.tab : "all";
  const operator = typeof b.operator === "string" ? b.operator : undefined;
  let logs: ReturnType<typeof auditStore.listAuditLogs>;
  if (tab === "all") {
    logs = auditStore.listAuditLogs(operator ? { operator } : undefined);
  } else {
    const allowed = TAB_TO_ACTIONS[tab]!;
    logs = auditStore
      .listAuditLogs(operator ? { operator } : undefined)
      .filter((l) => allowed.includes(l.action));
  }
  const header = ["id", "action", "operator", "resource", "resourceId", "ip", "detail", "timestamp"];
  const escape = (v: string | number): string => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = logs.map((l) =>
    [l.id, l.action, l.operator, l.resource, l.resourceId, l.ip, l.detail, l.timestamp]
      .map(escape)
      .join(","),
  );
  const csv = [header.join(","), ...body].join("\n");
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="audit-${tab}.csv"`,
    },
  });
}