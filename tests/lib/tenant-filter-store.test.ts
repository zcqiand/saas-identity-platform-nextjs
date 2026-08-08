// @vitest-environment jsdom
/**
 * M02.F01.I10 5 个管理页租户树过滤 —— URL ?tenant= 双向同步 hook
 *
 * 覆盖：
 *   - Initial render: selectedTenantId 反映当前 URL ?tenant=（缺省为 null）
 *   - setTenant('acme'): URL 变为 ?tenant=acme
 *   - setTenant 保留其它 query params
 *   - clear(): URL 去掉 ?tenant= 其它 params 保留
 *   - URL 改变时（外部 setSearchParams）hook 拿到新 selectedTenantId
 *
 * 实现注意：URL 是单一真相源。useSearchParams 触发 React 重渲染,hook 每次返回最新值。
 * setTenant / clear 只调 router.replace 写 URL —— 不再乐观更新本地镜像
 * （mirror state + useEffect 同步层已删除;Next.js useSearchParams 在 client 组件里
 *  返回非 null,直接读 URL 即可,无需兜底）。
 *
 * next/navigation 通过 vi.mock 全替,避免依赖真实 RouterContext。
 *
 * 全部 9 个用例通过 fnTest 挂 M02.F01.I10,run with TRACE_MAP=1 产出 trace.json。
 */
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";
import { fnTest } from "../fn";

// vi.mock 会被 hoist 到文件顶部,mock 工厂里的变量必须用 vi.hoisted 提供。
const mocks = vi.hoisted(() => {
  const useSearchParamsMock = vi.fn();
  const replaceMock = vi.fn();
  const useRouterMock = vi.fn(() => ({ replace: replaceMock }));
  const usePathnameMock = vi.fn(() => "/users");
  return { useSearchParamsMock, replaceMock, useRouterMock, usePathnameMock };
});

vi.mock("next/navigation", () => ({
  useSearchParams: mocks.useSearchParamsMock,
  useRouter: mocks.useRouterMock,
  usePathname: mocks.usePathnameMock,
}));

// 必须放在 vi.mock 之后 —— import 的模块在解析时才会触发 mock
import { useTenantFilter } from "@/lib/tenant-filter-store";

/**
 * 简易 URLSearchParams 工厂 —— useSearchParams().get("tenant") 走它。
 */
function makeSearchParams(initial: Record<string, string> = {}): URLSearchParams {
  return new URLSearchParams(initial);
}

const { useSearchParamsMock, replaceMock, useRouterMock, usePathnameMock } = mocks;

beforeEach(() => {
  useSearchParamsMock.mockReset();
  replaceMock.mockReset();
  useRouterMock.mockClear();
  usePathnameMock.mockReset();
  usePathnameMock.mockReturnValue("/users");
  useRouterMock.mockReturnValue({ replace: replaceMock });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("M02.F01.I10 useTenantFilter — URL ?tenant= 双向同步", () => {
  fnTest(["M02.F01.I10"], "初始无 tenant param：selectedTenantId === null", () => {
    useSearchParamsMock.mockReturnValue(makeSearchParams());
    const { result } = renderHook(() => useTenantFilter());
    expect(result.current.selectedTenantId).toBeNull();
  });

  fnTest(["M02.F01.I10"], "初始 URL ?tenant=acme：selectedTenantId === 'acme'", () => {
    useSearchParamsMock.mockReturnValue(makeSearchParams({ tenant: "acme" }));
    const { result } = renderHook(() => useTenantFilter());
    expect(result.current.selectedTenantId).toBe("acme");
  });

  fnTest(
    ["M02.F01.I10"],
    "setTenant('acme') 调 useRouter().replace → URL 变为 /users?tenant=acme",
    () => {
      useSearchParamsMock.mockReturnValue(makeSearchParams());
      const { result } = renderHook(() => useTenantFilter());

      act(() => {
        result.current.setTenant("acme");
      });

      expect(replaceMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith("/users?tenant=acme");
    },
  );

  fnTest(
    ["M02.F01.I10"],
    "setTenant 保留 URL 上其它 query params（来自当前 URLSearchParams）",
    () => {
      useSearchParamsMock.mockReturnValue(makeSearchParams({ q: "engineer", page: "2" }));
      const { result } = renderHook(() => useTenantFilter());

      act(() => {
        result.current.setTenant("acme");
      });

      expect(replaceMock).toHaveBeenCalledTimes(1);
      const calledWith = replaceMock.mock.calls[0]![0] as string;
      expect(calledWith).toMatch(/^\/users\?/);
      const qs = new URL(calledWith, "http://x").searchParams;
      expect(qs.get("tenant")).toBe("acme");
      expect(qs.get("q")).toBe("engineer");
      expect(qs.get("page")).toBe("2");
    },
  );

  fnTest(
    ["M02.F01.I10"],
    "clear() 调 useRouter().replace → URL 去掉 ?tenant=（不剩其它 params 时只剩 pathname）",
    () => {
      useSearchParamsMock.mockReturnValue(makeSearchParams({ tenant: "acme" }));
      const { result } = renderHook(() => useTenantFilter());

      act(() => {
        result.current.clear();
      });

      expect(replaceMock).toHaveBeenCalledTimes(1);
      expect(replaceMock).toHaveBeenCalledWith("/users");
    },
  );

  fnTest(["M02.F01.I10"], "clear() 保留 URL 上其它 query params", () => {
    useSearchParamsMock.mockReturnValue(
      makeSearchParams({ tenant: "acme", q: "engineer" }),
    );
    const { result } = renderHook(() => useTenantFilter());

    act(() => {
      result.current.clear();
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    const calledWith = replaceMock.mock.calls[0]![0] as string;
    expect(calledWith).toMatch(/^\/users\?/);
    const qs = new URL(calledWith, "http://x").searchParams;
    expect(qs.get("tenant")).toBeNull();
    expect(qs.get("q")).toBe("engineer");
  });

  fnTest(
    ["M02.F01.I10"],
    "外部 setSearchParams 改 URL 后,rerender 触发 hook 返回新 selectedTenantId",
    () => {
      // 初次：acme
      useSearchParamsMock.mockReturnValue(makeSearchParams({ tenant: "acme" }));
      const { result, rerender } = renderHook(() => useTenantFilter());
      expect(result.current.selectedTenantId).toBe("acme");

      // 外部改 URL → tenant-lab
      useSearchParamsMock.mockReturnValue(makeSearchParams({ tenant: "tenant-lab" }));
      rerender();
      expect(result.current.selectedTenantId).toBe("tenant-lab");

      // 外部去掉 URL 参数
      useSearchParamsMock.mockReturnValue(makeSearchParams());
      rerender();
      expect(result.current.selectedTenantId).toBeNull();
    },
  );

  fnTest(["M02.F01.I10"], "setTenant 时复用当前 pathname,避免硬编码路由", () => {
    usePathnameMock.mockReturnValue("/departments");
    useSearchParamsMock.mockReturnValue(makeSearchParams());
    const { result } = renderHook(() => useTenantFilter());

    act(() => {
      result.current.setTenant("tenant-lab");
    });

    expect(replaceMock).toHaveBeenCalledWith("/departments?tenant=tenant-lab");
  });

  fnTest(["M02.F01.I10"], "clear 时复用当前 pathname,不带 ?tenant=", () => {
    usePathnameMock.mockReturnValue("/roles");
    useSearchParamsMock.mockReturnValue(makeSearchParams({ tenant: "acme" }));
    const { result } = renderHook(() => useTenantFilter());

    act(() => {
      result.current.clear();
    });

    expect(replaceMock).toHaveBeenCalledWith("/roles");
  });
});
