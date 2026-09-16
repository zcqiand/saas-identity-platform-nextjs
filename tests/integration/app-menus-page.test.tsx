// M08 menus 页 OAuthClient 形状回归：页面只读 clientId/clientName（2026-09-12 收敛）。
// 背景 bug：运行时切到真后端（OAuthClient 形状）时页面读旧 App 字段 → 「当前应用 — ()」+ 下拉空。
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import MenuTreePage from "../../src/app/admin/clients/[clientId]/menus/page";
import { TestProviders } from "../state-helpers";
import { apps } from "../../../saas-identity-platform-msw/src/fixtures/seed";

function queryResult(data: unknown) {
  return {
    data,
    isPending: false,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
}
function mutStub() {
  return {
    mutate: () => {},
    mutateAsync: async () => ({ data: {} }),
    isPending: false,
    reset: () => {},
  };
}

// 页面走真源 tag 模块（不走 barrel），与 setup.ts 的全局桩路径不同，这里局部覆盖。
vi.mock("@/api/endpoints/admin-clients/admin-clients", () => ({
  useAdminClientsListClients: () =>
    queryResult({ data: { items: apps, page: 1, pageSize: apps.length, total: apps.length } }),
}));
vi.mock("@/api/endpoints/client-menus/client-menus", () => ({
  useClientMenusListSysMenus: () => queryResult({ data: [] }),
  useClientMenusCreateSysMenu: () => mutStub(),
  useClientMenusUpdateSysMenu: () => mutStub(),
  useClientMenusDeleteSysMenu: () => mutStub(),
  useClientMenusMoveSysMenu: () => mutStub(),
}));

describe("M08.F04 menus 页 — OAuthClient 契约形状", () => {
  it("头部显示 clientName + clientId，下拉含全部应用（纯契约形状数据下）", async () => {
    render(
      <TestProviders>
        <MenuTreePage params={Promise.resolve({ clientId: "lab-management" })} />
      </TestProviders>,
    );
    // fixture clientName 与页面渲染文本（头部 + Select 触发器值两处出现 → AllBy）
    const lab = apps.find((a) => a.clientId === "lab-management")!;
    expect((await screen.findAllByText(lab.clientName)).length).toBeGreaterThan(0);
    expect(screen.getByText(`(${lab.clientId})`)).toBeTruthy();
    // 下拉不空：每个 app 一个 option（data-testid 按 id 键，保持原有约定）。
    // radix Select 的 portal 内容默认不挂载，键盘事件走 open（jsdom 对 pointer capture 支持不全）。
    fireEvent.keyDown(screen.getByTestId("app-selector-trigger"), { key: "Enter" });
    for (const a of apps) {
      expect(screen.getByTestId(`app-option-${a.id}`)).toBeTruthy();
    }
  });
});
