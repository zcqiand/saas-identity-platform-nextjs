// M00.F05 — tenant-scoped 应用订阅列表
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "../state-helpers";
import TenantApplicationsListPage from "../../app/tenants/[tenantId]/applications/page";

describe("M00.F05 租户应用", () => {
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
});
