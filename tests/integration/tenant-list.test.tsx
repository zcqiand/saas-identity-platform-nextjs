import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TenantProvider } from "../state-helpers";
import TenantListPage from "../../app/tenants/page";

describe("M00.F01 租户管理（平台 admin）", () => {
  it("渲染租户列表，新建按钮挂 data-fn=M00.F01.I02", () => {
    render(
      <TenantProvider>
        <TenantListPage />
      </TenantProvider>,
    );
    const btn = screen.getAllByRole("button").find((b) => b.getAttribute("data-fn") === "M00.F01.I02");
    expect(btn).toBeTruthy();
    expect(screen.getAllByTestId("tenant-row").length).toBeGreaterThan(0);
  });
});