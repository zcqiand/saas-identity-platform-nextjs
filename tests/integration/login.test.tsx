// M03.F01.I01 — 账号密码登录
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TestProviders } from "../state-helpers";
import LoginPage from "../../app/login/page";

describe("M03.F01.I01 账号密码登录", () => {
  it("渲染登录表单，挂 data-fn=M03.F01.I01 的提交按钮", () => {
    render(
      <TestProviders>
        <LoginPage />
      </TestProviders>,
    );
    const btn = screen.getAllByRole("button").find((b) => b.getAttribute("data-fn") === "M03.F01.I01");
    expect(btn).toBeTruthy();
  });
});