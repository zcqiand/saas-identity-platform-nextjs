// M06.F01 — tenant-scoped 审计日志
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "../state-helpers";
import AuditListPage from "../../app/tenants/[tenantId]/audit/page";

describe("M06.F01 审计日志（tenant-scoped）", () => {
  it("渲染审计列表，导出按钮挂 data-fn=M06.F01.I03", async () => {
    const params = (await Promise.resolve({ tenantId: "abc" })) as unknown as Parameters<typeof AuditListPage>[0]["params"];
    render(
      <TestProviders>
        <AuditListPage params={params} />
      </TestProviders>,
    );
    expect(screen.getAllByRole("button").find((b) => b.getAttribute("data-fn") === "M06.F01.I03")).toBeTruthy();
  });
});