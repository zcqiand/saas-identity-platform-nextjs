import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, use: <T,>(p: T) => p };
});

import { TenantProvider } from "../state-helpers";
import RoleListPage from "../../app/t/[tenantId]/roles/page";

describe("M02.F01 角色权限（tenant-scoped）", () => {
  it("渲染角色列表，新建角色按钮挂 data-fn=M02.F01.I02", async () => {
    const params = Promise.resolve({ tenantId: "abc" });
    const element = await RoleListPage({ params });
    render(<TenantProvider>{element}</TenantProvider>);
    expect(screen.getAllByRole("button").find((b) => b.getAttribute("data-fn") === "M02.F01.I02")).toBeTruthy();
  });
});