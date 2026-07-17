import { listTenants } from "@/lib/tenant-store";
import { TenantsClient } from "./tenants-client";

/**
 * /tenants — 租户列表页（server shell）
 *
 * server 端直查 Drizzle，把初始数据递给 client component。
 * 数据获取走 server action / direct drizzle（项目 CLAUDE.md 第 2 节允许）。
 */
export default function TenantsPage() {
  const tenants = listTenants();
  return <TenantsClient initialTenants={tenants} />;
}