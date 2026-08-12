import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TenantProvider } from "../state-helpers";
import OAuthAppListPage from "../../app/oauth-apps/page";

describe("M04.F01 OAuth 应用（平台级）", () => {
  it("渲染应用列表，注册按钮挂 data-fn=M04.F01.I02", () => {
    render(
      <TenantProvider>
        <OAuthAppListPage />
      </TenantProvider>,
    );
    expect(screen.getAllByRole("button").find((b) => b.getAttribute("data-fn") === "M04.F01.I02")).toBeTruthy();
  });
});