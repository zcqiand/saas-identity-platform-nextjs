import { cookies } from "next/headers";
import { getCurrentTenant, setCurrentTenant } from "@/lib/tenant-store";
import { applyTheme, clearTheme } from "@/lib/theme";
import { ProtectedLayout } from "./layout-client";

/**
 * (protected) 路由组的根布局（server component）
 *
 * 流程：
 *   1. 读 cookie "saas_current_tenant" → id
 *   2. setCurrentTenant(id) 灌进 module-level 缓存（让下面 client / API 都能拿到）
 *   3. getCurrentTenant() 读 tenant 拿 theme + name
 *   4. applyTheme(theme) / clearTheme() 拿 CSS 字符串
 *   5. 透传给 client 组件 ProtectedLayout 渲染
 *
 * (M01.F01.I11 类型契约) 当前 cookie 不存在时 clearTheme() — 走「无租户」路径。
 */

export default async function ProtectedGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const cookieVal = cookieStore.get("saas_current_tenant")?.value;
  const cookieId = cookieVal ? Number(cookieVal) : null;

  let currentName: string | null = null;
  let themeCss = clearTheme();

  if (cookieId && Number.isInteger(cookieId) && cookieId > 0) {
    setCurrentTenant(cookieId);
    const t = getCurrentTenant();
    if (t) {
      currentName = t.name;
      themeCss = applyTheme(t.theme);
    }
  }

  return (
    <ProtectedLayout themeCss={themeCss} currentTenantName={currentName}>
      {children}
    </ProtectedLayout>
  );
}