"use client";

/**
 * M02.F01.I10 5 个管理页租户树过滤 —— URL ?tenant= 双向同步 hook
 *
 * 设计：URL 是 single source of truth。useSearchParams() 触发 React 重渲染，
 * 每次 render 读最新 ?tenant= 参数。setTenant / clear 走 router.replace 写 URL,
 * React 重渲染自然同步到 useSearchParams。
 *
 * 写入用 router.replace（不 push），避免污染浏览器历史栈；
 * 跨 5 个管理页切换时浏览器后退按钮依然按页面粒度回退而非按 tenant 切换。
 *
 * setTenant / clear 都通过 URLSearchParams 重建 URL，保留其它 query params
 * （encodeURIComponent 自动处理）。
 *
 * 与 src/lib/tenant-store.ts 的区别：
 *   - tenant-store.ts 是 server-only 数据访问层（list/get/create/update/delete）
 *   - tenant-filter-store.ts 是 client 端 UI 状态层（与 URL 双向同步）
 */
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface TenantFilter {
  /** 当前 ?tenant= 值。无参数时为 null。 */
  selectedTenantId: string | null;
  /** 切到指定租户：URL 变为 `${pathname}?tenant=id`（保留其它 query）。 */
  setTenant: (id: string) => void;
  /** 清除租户过滤：URL 去掉 ?tenant=（保留其它 query）。 */
  clear: () => void;
}

export function useTenantFilter(): TenantFilter {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedTenantId = searchParams.get("tenant");

  const setTenant = (id: string): void => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("tenant", id);
    router.replace(`${pathname}?${next.toString()}`);
  };

  const clear = (): void => {
    const next = new URLSearchParams(searchParams.toString());
    next.delete("tenant");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname);
  };

  return {
    selectedTenantId,
    setTenant,
    clear,
  };
}
