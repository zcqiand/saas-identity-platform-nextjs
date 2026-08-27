// M03.F01.I01 - 账号密码登录
//
// PLAN-2026-001 T-9 姊妹任务：同步 423/429 锁定提示到 nextjs LoginPage。
// 策略与 saas-react 同款：mock authLogin 端点函数 + sonner toast。
// 注意 nextjs Route Handler 的 lockout 返 429（aspnetcore 返 423）- 两个都要覆盖。
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TestProviders } from "../state-helpers";
import LoginPage from "../../app/login/page";
import { ApiError } from "../../src/api/http-client";

// mock orval 端点函数（Login 直接 await authLogin）
const { authLoginMock } = vi.hoisted(() => ({ authLoginMock: vi.fn() }));
vi.mock("../../src/api/endpoints/endpoints", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/api/endpoints/endpoints")
  >();
  return { ...actual, authLogin: authLoginMock };
});

// mock toast：捕获 toast.error 文案
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
}));

async function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText(/用户名/), {
    target: { value: "alice" },
  });
  fireEvent.change(screen.getByLabelText(/密码/), {
    target: { value: "dev123456" },
  });
  fireEvent.submit(screen.getByRole("button", { name: /登/ }));
}

beforeEach(() => {
  authLoginMock.mockReset();
  toastError.mockReset();
  localStorage.clear();
});

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

  it("提交 username/password -> POST /auth/login（端点参数一致）", async () => {
    authLoginMock.mockResolvedValue({
      data: {
        accessToken: "at-1",
        refreshToken: "rt-1",
        userId: "u-1",
        currentTenantId: "t-1",
      },
    });
    render(
      <TestProviders>
        <LoginPage />
      </TestProviders>,
    );
    await fillAndSubmit();
    expect(authLoginMock).toHaveBeenCalledWith({
      username: "alice",
      password: "dev123456",
    });
  });

  it("错密码（401）-> toast 显示用户名或密码错误", async () => {
    authLoginMock.mockRejectedValue(
      new ApiError(401, null, "invalid credentials"),
    );
    render(
      <TestProviders>
        <LoginPage />
      </TestProviders>,
    );
    await fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith("用户名或密码错误");
  });

  it("账号锁定（429 - nextjs Route Handler lockout）-> toast 显示锁定提示", async () => {
    authLoginMock.mockRejectedValue(
      new ApiError(429, { code: "ACCOUNT_LOCKED" }, "account locked"),
    );
    render(
      <TestProviders>
        <LoginPage />
      </TestProviders>,
    );
    await fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]?.[0])).toContain("锁定");
  });

  it("账号锁定（423 - aspnetcore 后端 lockout）-> toast 显示锁定提示", async () => {
    authLoginMock.mockRejectedValue(
      new ApiError(423, { code: "ACCOUNT_LOCKED" }, "account locked"),
    );
    render(
      <TestProviders>
        <LoginPage />
      </TestProviders>,
    );
    await fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]?.[0])).toContain("锁定");
  });
});
