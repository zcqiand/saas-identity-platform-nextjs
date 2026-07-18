import { cookies } from "next/headers";
import { setCurrentTenant } from "@/lib/tenant-store";
import { ProtectedLayout } from "./layout-client";

/**
 * (protected) 路由组的根布局（server component）
 *
 * 流程：
 *   1. 读 cookie "saas_current_tenant" → id
 *   2. setCurrentTenant(id) 灌进 module-level 缓存（让下面 client / API 都能拿到）
 *
 * CSS 和 current tenant 由 ProtectedLayout 客户端组件自己从 tenantStore 读
 * （这样 jsdom 单测不用传 props 也能跑通）。
 */

export default async function ProtectedGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get("saas_current_tenant")?.value;
  const cookieId = cookieVal ? Number(cookieVal) : null;

  if (cookieId && Number.isInteger(cookieId) && cookieId > 0) {
    setCurrentTenant(cookieId);
  }

  return <ProtectedLayout>{children}</ProtectedLayout>;
}