import { listAuditLogs } from "@/lib/audit-store";
import { AuditLogsClient, type AuditLogRow } from "./audit-logs-client";

export default async function AuditLogsPage() {
  const logs = (await listAuditLogs()) as unknown as AuditLogRow[];
  return <AuditLogsClient initialLogs={logs} />;
}