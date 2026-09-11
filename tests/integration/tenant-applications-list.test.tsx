// M00.F05 — tenant-scoped 应用订阅列表
// 本文件级 mock 覆盖 setup 全局桩：断言应用名称列（join admin-clients）
// 与状态中文标签（家族约定 0=待激活/1=启用/2=停用，此前 msw 无 handler 落 faker 巨数）。
import { beforeEach, describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "../state-helpers";
import TenantApplicationsListPage from "../../app/tenants/[tenantId]/applications/page";

const { state } = vi.hoisted(() => ({
  state: {
    apps: [
      { id: "t1", tenantId: "abc", clientId: "lab-management", status: 1, expireTime: "2027-01-01T00:00:00Z", createdAt: "2026-01-20T08:00:00Z" },
      { id: "t2", tenantId: "abc", clientId: "erp", status: 0, createdAt: "2026-02-14T09:30:00Z" },
    ],
    clients: [
      { id: "c1", clientId: "c1", code: "lab-management", name: "建筑工程实验室管理系统" },
      { id: "c2", clientId: "c2", code: "erp", name: "企业资源计划系统" },
    ] as Array<Record<string, string>>,
  },
}));

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

vi.mock("@/api/endpoints/endpoints", () => ({
  useAdminTenantsGetTenant: () => queryResult({ data: { name: "ACME Corp", tenantKey: "acme" } }),
  useTenantApplicationsListTenantApplications: () =>
    queryResult({ data: { items: state.apps } }),
  useTenantApplicationsSubscribeTenantApplication: () => mutStub(),
  useTenantApplicationsUpdateTenantApplication: () => mutStub(),
  useTenantApplicationsRemoveTenantApplication: () => mutStub(),
  useAdminClientsListClients: () => queryResult({ data: { items: state.clients } }),
}));

describe("M00.F05 租户应用", () => {
  beforeEach(() => {
    state.apps = [
      { id: "t1", tenantId: "abc", clientId: "lab-management", status: 1, expireTime: "2027-01-01T00:00:00Z", createdAt: "2026-01-20T08:00:00Z" },
      { id: "t2", tenantId: "abc", clientId: "erp", status: 0, createdAt: "2026-02-14T09:30:00Z" },
    ];
  });

  it("渲染订阅应用按钮挂 data-fn=M00.F05.I02", async () => {
    const params = (await Promise.resolve({
      tenantId: "abc",
    })) as unknown as Parameters<typeof TenantApplicationsListPage>[0]["params"];
    render(
      <TestProviders>
        <TenantApplicationsListPage params={params} />
      </TestProviders>,
    );
    expect(
      screen
        .getAllByRole("button")
        .find((b) => b.getAttribute("data-fn") === "M00.F05.I02"),
    ).toBeTruthy();
  });

  it("空列表显示 EmptyState", async () => {
    state.apps = [];
    const params = (await Promise.resolve({
      tenantId: "abc",
    })) as unknown as Parameters<typeof TenantApplicationsListPage>[0]["params"];
    render(
      <TestProviders>
        <TenantApplicationsListPage params={params} />
      </TestProviders>,
    );
    expect(screen.getByText(/还没有订阅应用/)).toBeTruthy();
  });

  it("列表行渲染应用名称（join admin-clients）+ 状态中文标签", async () => {
    const params = (await Promise.resolve({
      tenantId: "abc",
    })) as unknown as Parameters<typeof TenantApplicationsListPage>[0]["params"];
    render(
      <TestProviders>
        <TenantApplicationsListPage params={params} />
      </TestProviders>,
    );
    await screen.findByText("建筑工程实验室管理系统");
    expect(screen.getByText("企业资源计划系统")).toBeTruthy();
    expect(screen.getAllByTestId("tenant-app-row")).toHaveLength(2);
    expect(screen.getByText("启用")).toBeTruthy();
    expect(screen.getByText("待激活")).toBeTruthy();
  });
});
