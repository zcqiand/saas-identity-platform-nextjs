import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, use: <T,>(p: T) => p };
});

import { TenantProvider } from "../state-helpers";
import AuditListPage from "../../app/t/[tenantId]/audit/page";

describe("M06.F01 审计日志（tenant-scoped）", () => {
  it("渲染审计列表，导出按钮挂 data-fn=M06.F01.I03", async () => {
    const params = Promise.resolve({ tenantId: "abc" });
    const element = await AuditListPage({ params });
    render(<TenantProvider>{element}</TenantProvider>);
    expect(screen.getAllByRole("button").find((b) => b.getAttribute("data-fn") === "M06.F01.I03")).toBeTruthy();
  });
});