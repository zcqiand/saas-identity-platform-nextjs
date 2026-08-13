// M02.F01 — tenant-scoped 角色列表
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "../state-helpers";
import RoleListPage from "../../app/tenants/[tenantId]/roles/page";

describe("M02.F01 角色权限（tenant-scoped）", () => {
  it("渲染角色列表，新建角色按钮挂 data-fn=M02.F01.I02", async () => {
    const params = (await Promise.resolve({ tenantId: "abc" })) as unknown as Parameters<typeof RoleListPage>[0]["params"];
    render(
      <TestProviders>
        <RoleListPage params={params} />
      </TestProviders>,
    );
    expect(screen.getAllByRole("button").find((b) => b.getAttribute("data-fn") === "M02.F01.I02")).toBeTruthy();
  });
});