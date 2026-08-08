"use client";

/**
 * M02.F01.I10 5 个管理页租户树过滤 —— URL ?tenant= 双向同步 hook
 *
 * 设计：URL 是 single source of truth。useSearchParams 触发 React 重渲染，
 * 每次 render 拿最新 ?tenant= 参数。setTenant / clear 触发 router.replace
 * 写 URL 后，React 重渲染自然同步到 useSearchParams。
 *
 * 额外加一层乐观更新：setTenant 调完到 URL 真正生效（next/navigation 的
 * shallow router state）需要一拍 render 间隔，本地用 mirror state 补这一拍，
 * 避免点击后短暂一帧仍显示旧选中态。URL 一旦变化，mirror 失效。
 *
 * 写入用 router.replace（不 push），避免污染浏览器历史栈；
 * 跨 5 个管理页切换时浏览器后退按钮依然按页面粒度回退而非按 tenant 切换。
 *
 * 与 src/lib/tenant-store.ts 的区别：
 *   - tenant-store.ts 是 server-only 数据访问层（list/get/create/update/delete）
 *   - tenant-filter-store.ts 是 client 端 UI 状态层（与 URL 双向同步）
 */
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export interface TenantFilter {
  /** 当前 ?tenant= 值。无参数时为 null。 */
  selectedTenantId: string | null;
  /** 切到指定租户：URL 变为 `${pathname}?tenant=${id}`。 */
  setTenant: (id: string) => void;
  /** 清除租户过滤：URL 去掉 ?tenant=。 */
  clear: () => void;
}

export function useTenantFilter(): TenantFilter {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // 乐观更新镜像：setTenant / clear 调用后立即反映。
  const [mirror, setMirror] = useState<URLSearchParams | null>(null);

  // URL 变化（外部 navigate / 浏览器后退 / 用户另一处 setSearchParams）时
  // 失效 mirror，让 URL 校准下一帧。
  useEffect(() => {
    setMirror(null);
  }, [searchParams]);

  const effective = mirror ?? searchParams;
  const selectedTenantId = effective?.get("tenant") ?? null;

  const setTenant = (id: string): void => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.set("tenant", id);
    setMirror(next);
    const base = pathname ?? "/";
    router.replace(`${base}?tenant=${id}`);
  };

  const clear = (): void => {
    const next = new URLSearchParams(searchParams?.toString() ?? "");
    next.delete("tenant");
    setMirror(next);
    const base = pathname ?? "/";
    router.replace(base);
  };

  return {
    selectedTenantId,
    setTenant,
    clear,
  };
}
