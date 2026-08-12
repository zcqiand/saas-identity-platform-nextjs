// M00.F02.I03 — 切换租户
import { describe, it, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { TestProviders } from "../state-helpers";
import { TenantSwitcher } from "../../src/components/tenant-switcher";

describe("M00.F02.I03 当前用户跨租户切换", () => {
  it("渲染 TenantSwitcher，下拉框挂 data-fn=M00.F02.I03", async () => {
    render(
      <TestProviders>
        <TenantSwitcher />
      </TestProviders>,
    );
    await waitFor(() => {
      const select = screen.getByTestId("tenant-switcher").querySelector("select");
      expect(select).toBeTruthy();
      expect(select?.getAttribute("data-fn")).toBe("M00.F02.I03");
    });
  });
});