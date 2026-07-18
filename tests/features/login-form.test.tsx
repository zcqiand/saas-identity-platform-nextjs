// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import { LoginForm } from "@/app/login/login-form";
import { fnTest } from "../fn";

afterEach(() => {
  cleanup();
});

/**
 * M01.F04.I04 登录入口页 — LoginForm 组件测试
 *
 * 验证：
 *   - 渲染「使用 SSO 登录」按钮，挂 data-fn="M01.F04.I04"
 *   - 点击按钮触发 window.location.href 跳到 /api/sso/authorize
 */
describe("M01.F04.I04 LoginForm", () => {
  fnTest(["M01.F04.I04"], "renders SSO button with data-fn M01.F04.I04", () => {
    const { getByTestId } = render(<LoginForm />);
    const btn = getByTestId("sso-login-btn");
    expect(btn.getAttribute("data-fn")).toBe("M01.F04.I04");
    expect(btn.textContent).toContain("SSO");
  });

  it("点击按钮触发跳转到 /api/sso/authorize", () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...originalLocation, href: "" },
    });

    const { getByTestId } = render(<LoginForm />);
    const btn = getByTestId("sso-login-btn");
    fireEvent.click(btn);

    // buildAuthorizeUrl 默认 endpoint = http://localhost:3000/api/sso/authorize
    expect(window.location.href).toContain("/api/sso/authorize");
    expect(window.location.href).toContain("client_id=saas-web");
    expect(window.location.href).toContain("response_type=code");
    expect(window.location.href).toContain("state=");

    // restore
    Object.defineProperty(window, "location", {
      writable: true,
      value: originalLocation,
    });
  });
});