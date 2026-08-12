import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, use: <T,>(p: T) => p };
});

import { TenantProvider } from "../state-helpers";
import UserListPage from "../../app/t/[tenantId]/users/page";

describe("M01.F01 用户管理（tenant-scoped）", () => {
  it("渲染用户列表，邀请按钮挂 data-fn=M01.F01.I02", async () => {
    const params = Promise.resolve({ tenantId: "abc" });
    const element = await UserListPage({ params });
    render(<TenantProvider>{element}</TenantProvider>);
    const btn = screen.getAllByRole("button").find((b) => b.getAttribute("data-fn") === "M01.F01.I02");
    expect(btn).toBeTruthy();
  });
});