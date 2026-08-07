import { cookies } from "next/headers";
import { applyTheme, clearTheme } from "@/lib/theme";
import { getCurrentTenant, setCurrentTenant } from "@/lib/tenant-store";
import { ProtectedLayout } from "./layout-client";

/**
 * (protected) 路由组的根布局（server component）
 *
 * 流程：
 *   1. 读 cookie "saas_current_tenant" → id
 *   2. setCurrentTenant(id) 灌进 module-level 缓存（让下面 client / API 都能拿到）
 *   3. getCurrentTenant() 拿 theme → 调 applyTheme / clearTheme
 *   4. 把 css 透传给 client 组件 ProtectedLayout
 *
 * 为什么不在 client 组件里直接调 applyTheme？tenant-store.ts 是 server-only
 * （import 'server-only'），import 链：layout-client → tenant-store → "server-only"
 * → next.js client 端拒绝编译。CSS 必须在 server 端算好透传过来。
 */

export default async function ProtectedGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  // v0.3.0：tenants.id 从 serial 改 text，cookie 存的就是 text id（如 "acme"），原样透传
  const cookieId = cookieStore.get("saas_current_tenant")?.value ?? null;

  let css: string | null = null;
  let tenantName: string | null = null;

  if (cookieId) {
    setCurrentTenant(cookieId);
    const t = await getCurrentTenant();
    if (t) {
      tenantName = t.name;
      css = applyTheme(t.theme);
    }
  }
  // 没 cookie / 该 id 查无租户 → 不渲染 <style>（保持默认主题）
  if (css === null) css = clearTheme();

  return (
    <ProtectedLayout themeCss={css} currentTenantName={tenantName}>
      {children}
    </ProtectedLayout>
  );
}