// @vitest-environment jsdom
/**
 * M01.F01.I08（复用）— tenant-tree-sidebar 组件
 *
 * 覆盖：
 *   - 初始渲染：2 个 tenant 节点（acme + tenant-lab）+ 「全部」按钮可见
 *   - 节点点击 → useTenantFilter().setTenant('acme')（间接 = router.replace ?tenant=）
 *   - 「全部」按钮 → useTenantFilter().clear()（router.replace 去掉 ?tenant=）
 *   - selectedTenantId === 'acme' 时，acme 节点带 data-active="true" 且 aria-current="true"
 *   - 每个节点含 summary 文本 "N 部门 / N 用户 / N 角色"（hardcode 计数）
 *
 * Mock 策略：
 *   - useTenantFilter 走 vi.mock("@/lib/tenant-filter-store", ...) — 不耦合 URL 同步
 *   - next/navigation 走 vi.mock(...)
 *
 * 实现细节：本组件 mock 了 useTenantFilter，不直接验证 useRouter().replace —— 那
 * 是 tenant-filter-store 的职责，本测试只验证 sidebar 把意图传给 store。
 */
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { fnTest } from "../fn";

const mocks = vi.hoisted(() => {
  const useSearchParamsMock = vi.fn();
  const replaceMock = vi.fn();
  const useRouterMock = vi.fn(() => ({ replace: replaceMock }));
  const usePathnameMock = vi.fn(() => "/users");
  // useTenantFilter 的可调 mock —— 每个 test 可重置 selectedTenantId
  let selectedTenantId: string | null = null;
  const setTenantMock = vi.fn((id: string) => {
    selectedTenantId = id;
  });
  const clearMock = vi.fn(() => {
    selectedTenantId = null;
  });
  return {
    useSearchParamsMock,
    replaceMock,
    useRouterMock,
    usePathnameMock,
    useTenantFilterMock: vi.fn(() => ({
      get selectedTenantId() {
        return selectedTenantId;
      },
      setTenant: setTenantMock,
      clear: clearMock,
    })),
    setTenantMock,
    clearMock,
    setSelectedTenantId: (v: string | null) => {
      selectedTenantId = v;
    },
  };
});

vi.mock("next/navigation", () => ({
  useSearchParams: mocks.useSearchParamsMock,
  useRouter: mocks.useRouterMock,
  usePathname: mocks.usePathnameMock,
}));

vi.mock("@/lib/tenant-filter-store", () => ({
  useTenantFilter: mocks.useTenantFilterMock,
}));

// 必须放在 vi.mock 之后 —— import 的模块在解析时才会触发 mock
import { TenantTreeSidebar } from "@/components/app/tenant-tree-sidebar";

const {
  useSearchParamsMock,
  replaceMock,
  useRouterMock,
  usePathnameMock,
  useTenantFilterMock,
  setTenantMock,
  clearMock,
  setSelectedTenantId,
} = mocks;

beforeEach(() => {
  useSearchParamsMock.mockReset();
  useSearchParamsMock.mockReturnValue(new URLSearchParams());
  replaceMock.mockReset();
  useRouterMock.mockClear();
  useRouterMock.mockReturnValue({ replace: replaceMock });
  usePathnameMock.mockReset();
  usePathnameMock.mockReturnValue("/users");
  useTenantFilterMock.mockClear();
  setTenantMock.mockReset();
  clearMock.mockReset();
  setSelectedTenantId(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("M01.F01.I08 tenant-tree-sidebar", () => {
  fnTest(
    ["M01.F01.I08"],
    "初始渲染：2 个 tenant 节点（acme + tenant-lab）+ 「全部」按钮可见",
    () => {
      const { getByTestId } = render(<TenantTreeSidebar />);

      // 容器根存在 + data-fn 锚点
      expect(getByTestId("tenant-tree-sidebar").getAttribute("data-fn")).toBe(
        "M01.F01.I08",
      );

      // 2 个节点
      expect(getByTestId("tenant-node-acme")).toBeTruthy();
      expect(getByTestId("tenant-node-tenant-lab")).toBeTruthy();

      // 「全部」按钮
      expect(getByTestId("tenant-tree-clear")).toBeTruthy();
      expect(getByTestId("tenant-tree-clear").textContent).toBe("全部");
    },
  );

  fnTest(["M01.F01.I08"], "点击 acme 节点 → useTenantFilter().setTenant('acme')", () => {
    const { getByTestId } = render(<TenantTreeSidebar />);

    getByTestId("tenant-node-acme").click();

    expect(setTenantMock).toHaveBeenCalledTimes(1);
    expect(setTenantMock).toHaveBeenCalledWith("acme");
  });

  fnTest(["M01.F01.I08"], "点击 tenant-lab 节点 → setTenant('tenant-lab')", () => {
    const { getByTestId } = render(<TenantTreeSidebar />);

    getByTestId("tenant-node-tenant-lab").click();

    expect(setTenantMock).toHaveBeenCalledTimes(1);
    expect(setTenantMock).toHaveBeenCalledWith("tenant-lab");
  });

  fnTest(
    ["M01.F01.I08"],
    "点击「全部」按钮 → useTenantFilter().clear()（drop ?tenant= 意图）",
    () => {
      const { getByTestId } = render(<TenantTreeSidebar />);

      getByTestId("tenant-tree-clear").click();

      expect(clearMock).toHaveBeenCalledTimes(1);
    },
  );

  fnTest(
    ["M01.F01.I08"],
    "selectedTenantId === 'acme' 时 acme 节点 data-active=true + aria-current=true，其它节点不 active",
    () => {
      setSelectedTenantId("acme");
      const { getByTestId } = render(<TenantTreeSidebar />);

      const acme = getByTestId("tenant-node-acme");
      expect(acme.getAttribute("data-active")).toBe("true");
      expect(acme.getAttribute("aria-current")).toBe("true");

      const tenantLab = getByTestId("tenant-node-tenant-lab");
      expect(tenantLab.getAttribute("data-active")).toBeNull();
      expect(tenantLab.getAttribute("aria-current")).toBeNull();
    },
  );

  fnTest(
    ["M01.F01.I08"],
    "selectedTenantId === 'tenant-lab' 时 tenant-lab 节点 data-active=true，acme 不 active",
    () => {
      setSelectedTenantId("tenant-lab");
      const { getByTestId } = render(<TenantTreeSidebar />);

      const tenantLab = getByTestId("tenant-node-tenant-lab");
      expect(tenantLab.getAttribute("data-active")).toBe("true");

      const acme = getByTestId("tenant-node-acme");
      expect(acme.getAttribute("data-active")).toBeNull();
    },
  );

  fnTest(
    ["M01.F01.I08"],
    "selectedTenantId === null 时所有节点都不 active",
    () => {
      setSelectedTenantId(null);
      const { getByTestId } = render(<TenantTreeSidebar />);

      expect(getByTestId("tenant-node-acme").getAttribute("data-active")).toBeNull();
      expect(getByTestId("tenant-node-tenant-lab").getAttribute("data-active")).toBeNull();
    },
  );

  fnTest(
    ["M01.F01.I08"],
    "每个节点含 'N 部门 / N 用户 / N 角色' 汇总文本（hardcode 计数，TODO v0.5.x 接 SWR）",
    () => {
      const { getByTestId } = render(<TenantTreeSidebar />);

      const acme = getByTestId("tenant-node-acme");
      expect(acme.textContent).toMatch(/部门/);
      expect(acme.textContent).toMatch(/用户/);
      expect(acme.textContent).toMatch(/角色/);
      // acme 计数 2 部门 / 13 用户 / 10 角色（hardcode）
      expect(acme.textContent).toContain("2");
      expect(acme.textContent).toContain("13");
      expect(acme.textContent).toContain("10");

      const tenantLab = getByTestId("tenant-node-tenant-lab");
      expect(tenantLab.textContent).toMatch(/部门/);
      expect(tenantLab.textContent).toMatch(/用户/);
      expect(tenantLab.textContent).toMatch(/角色/);
      // tenant-lab 计数 0 部门 / 2 用户 / 2 角色（hardcode）
      expect(tenantLab.textContent).toContain("0");
      expect(tenantLab.textContent).toContain("2");
    },
  );
});