// @vitest-environment jsdom
/**
 * M02.F01.I10 5 个管理页租户树过滤 —— URL ?tenant= 双向同步 hook
 *
 * 覆盖：
 *   - Initial render: selectedTenantId 反映当前 URL ?tenant=（缺省为 null）
 *   - setTenant('acme'): URL 变为 ?tenant=acme 且 selectedTenantId === 'acme'
 *   - clear(): URL 去掉 ?tenant= 且 selectedTenantId === null
 *   - URL 改变时（外部 setSearchParams）hook 拿到新 selectedTenantId
 *
 * 实现注意：URL 是单一真相源。useSearchParams 触发 React 重渲染，hook 每次返回最新值。
 * next/navigation 通过 vi.mock 全替，避免依赖真实 RouterContext。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, act } from "@testing-library/react";

// vi.mock 会被 hoist 到文件顶部，mock 工厂里的变量必须用 vi.hoisted 提供。
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
  it("初始无 tenant param：selectedTenantId === null", () => {
    useSearchParamsMock.mockReturnValue(makeSearchParams());
    const { result } = renderHook(() => useTenantFilter());
    expect(result.current.selectedTenantId).toBeNull();
  });

  it("初始 URL ?tenant=acme：selectedTenantId === 'acme'", () => {
    useSearchParamsMock.mockReturnValue(makeSearchParams({ tenant: "acme" }));
    const { result } = renderHook(() => useTenantFilter());
    expect(result.current.selectedTenantId).toBe("acme");
  });

  it("setTenant('acme') 调 useRouter().replace → URL 变为 /users?tenant=acme", () => {
    useSearchParamsMock.mockReturnValue(makeSearchParams());
    const { result } = renderHook(() => useTenantFilter());

    act(() => {
      result.current.setTenant("acme");
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/users?tenant=acme");
  });

  it("setTenant('acme') 后 hook 立刻返回 selectedTenantId === 'acme'（乐观更新）", () => {
    useSearchParamsMock.mockReturnValue(makeSearchParams());
    const { result } = renderHook(() => useTenantFilter());

    act(() => {
      result.current.setTenant("acme");
    });

    expect(result.current.selectedTenantId).toBe("acme");
  });

  it("clear() 调 useRouter().replace → URL 去掉 ?tenant=", () => {
    useSearchParamsMock.mockReturnValue(makeSearchParams({ tenant: "acme" }));
    const { result } = renderHook(() => useTenantFilter());

    act(() => {
      result.current.clear();
    });

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith("/users");
  });

  it("clear() 后 hook 立刻返回 selectedTenantId === null", () => {
    useSearchParamsMock.mockReturnValue(makeSearchParams({ tenant: "acme" }));
    const { result } = renderHook(() => useTenantFilter());

    act(() => {
      result.current.clear();
    });

    expect(result.current.selectedTenantId).toBeNull();
  });

  it("外部 setSearchParams 改 URL 后，rerender 触发 hook 返回新 selectedTenantId", () => {
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
  });

  it("setTenant 时复用当前 pathname，避免硬编码路由", () => {
    usePathnameMock.mockReturnValue("/departments");
    useSearchParamsMock.mockReturnValue(makeSearchParams());
    const { result } = renderHook(() => useTenantFilter());

    act(() => {
      result.current.setTenant("tenant-lab");
    });

    expect(replaceMock).toHaveBeenCalledWith("/departments?tenant=tenant-lab");
  });

  it("clear 时复用当前 pathname，不带 ?tenant=", () => {
    usePathnameMock.mockReturnValue("/roles");
    useSearchParamsMock.mockReturnValue(makeSearchParams({ tenant: "acme" }));
    const { result } = renderHook(() => useTenantFilter());

    act(() => {
      result.current.clear();
    });

    expect(replaceMock).toHaveBeenCalledWith("/roles");
  });
});
