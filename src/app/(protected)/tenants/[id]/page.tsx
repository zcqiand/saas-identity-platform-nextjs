import { notFound } from "next/navigation";
import { getTenant } from "@/lib/tenant-store";
import { TenantEditForm } from "./tenant-edit-form";

/**
 * /tenants/[id] — 租户详情/编辑页（server shell）
 */
export default async function TenantEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const numericId = Number(id);
  if (!Number.isInteger(numericId) || numericId <= 0) {
    notFound();
  }
  const tenant = getTenant(numericId);
  if (!tenant) {
    notFound();
  }
  return <TenantEditForm tenant={tenant} />;
}