// M01.F04.I03 - 账号密码登录
//
// 2026-09-11 B 方案对齐 vue 基准：clientId 门（?client_id= ?? env）+
// useSessionsLogin（LoginRequest 契约 clientId required）。
// 注意 nextjs Route Handler 的 lockout 返 429（aspnetcore 返 423）- 两个都要覆盖。
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TestProviders } from "../state-helpers";
import LoginPage from "../../app/login/page";
import { ApiError } from "../../src/api/http-client";

// mock orval hook（LoginPage 用 useSessionsLogin().mutateAsync）
const { sessionsLoginMock } = vi.hoisted(() => ({ sessionsLoginMock: vi.fn() }));
vi.mock("../../src/api/endpoints/auth/auth", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/api/endpoints/auth/auth")
  >();
  return {
    ...actual,
    useSessionsLogin: () => ({ mutateAsync: sessionsLoginMock }),
  };
});

// mock toast：捕获 toast.error 文案（Toaster 组件随 LoginPage 自挂，mock 成空渲染）
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
  Toaster: () => null,
}));

const LOGIN_RESPONSE = {
  accessToken: "at-1",
  refreshToken: "rt-1",
  user: { id: "u-1", email: "alice@acme.io" },
  availableTenants: [{ tenantId: "t-1" }],
  clientId: "cid-test",
};

// LoginPage 读 window.location.search（不依赖路由 query 时序）——jsdom 侧同步设 URL
function renderLogin(url = "/login?client_id=cid-test") {
  window.history.replaceState({}, "", url);
  render(
    <TestProviders>
      <LoginPage />
    </TestProviders>,
  );
}

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
  sessionsLoginMock.mockReset();
  toastError.mockReset();
  localStorage.clear();
  window.history.replaceState({}, "", "/login");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("M01.F04.I03 账号密码登录", () => {
  it("渲染登录表单，挂 data-fn=M01.F04.I03 的提交按钮", () => {
    renderLogin();
    const btn = screen.getAllByRole("button").find((b) => b.getAttribute("data-fn") === "M01.F04.I03");
    expect(btn).toBeTruthy();
  });

  it("无 client_id（query 与 env 均缺）提交 -> toast 缺少 clientId 且不发请求", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOGIN_CLIENT_ID", "");
    renderLogin("/login");
    await fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]?.[0])).toContain("clientId");
    expect(sessionsLoginMock).not.toHaveBeenCalled();
  });

  it("env NEXT_PUBLIC_LOGIN_CLIENT_ID 可作兜底（无 query 时）", async () => {
    vi.stubEnv("NEXT_PUBLIC_LOGIN_CLIENT_ID", "cid-from-env");
    sessionsLoginMock.mockResolvedValue({ data: LOGIN_RESPONSE });
    renderLogin("/login");
    await fillAndSubmit();
    await waitFor(() =>
      expect(sessionsLoginMock).toHaveBeenCalledWith({
        data: { username: "alice", password: "dev123456", clientId: "cid-from-env" },
      }),
    );
  });

  it("提交 username/password/clientId -> POST /auth/login（端点参数一致，LoginRequest required）", async () => {
    sessionsLoginMock.mockResolvedValue({ data: LOGIN_RESPONSE });
    renderLogin();
    await fillAndSubmit();
    expect(sessionsLoginMock).toHaveBeenCalledWith({
      data: { username: "alice", password: "dev123456", clientId: "cid-test" },
    });
  });

  it("登录响应缺 token -> toast 提示", async () => {
    sessionsLoginMock.mockResolvedValue({
      data: { ...LOGIN_RESPONSE, accessToken: undefined, refreshToken: undefined },
    });
    renderLogin();
    await fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]?.[0])).toContain("token");
  });

  it("错密码（401）-> toast 显示用户名或密码错误", async () => {
    sessionsLoginMock.mockRejectedValue(
      new ApiError(401, null, "invalid credentials"),
    );
    renderLogin();
    await fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(toastError).toHaveBeenCalledWith("用户名或密码错误");
  });

  it("账号锁定（429 - nextjs Route Handler lockout）-> toast 显示锁定提示", async () => {
    sessionsLoginMock.mockRejectedValue(
      new ApiError(429, { code: "ACCOUNT_LOCKED" }, "account locked"),
    );
    renderLogin();
    await fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]?.[0])).toContain("锁定");
  });

  it("账号锁定（423 - aspnetcore 后端 lockout）-> toast 显示锁定提示", async () => {
    sessionsLoginMock.mockRejectedValue(
      new ApiError(423, { code: "ACCOUNT_LOCKED" }, "account locked"),
    );
    renderLogin();
    await fillAndSubmit();
    await waitFor(() => expect(toastError).toHaveBeenCalled());
    expect(String(toastError.mock.calls[0]?.[0])).toContain("锁定");
  });
});
