import { listAuditLogs } from "@/lib/audit-store";
import { AuditLogsClient, type AuditLogRow } from "./audit-logs-client";

export default function AuditLogsPage() {
  const logs = listAuditLogs() as unknown as AuditLogRow[];
  return <AuditLogsClient initialLogs={logs} />;
}