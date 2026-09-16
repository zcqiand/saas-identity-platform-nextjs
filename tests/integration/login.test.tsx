// M01.F04.I03 - 账号密码登录
//
// 2026-09-11 B 方案对齐 vue 基准：clientId 门（?client_id= ?? env）+
// useSessionsLogin（LoginRequest 契约 clientId required）。
// 注意 nextjs Route Handler 的 lockout 返 429（aspnetcore 返 423）- 两个都要覆盖。
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { TestProviders } from "../state-helpers";
import LoginPage from "../../src/app/login/page";
import { ApiError } from "../../src/api/http-client";

// mock orval hook（LoginPage 用 useSessionsLogin().mutateAsync）；
// loginHookOptions 捕获 hook 收到的 {axios} options（IdP 同源钉死回归用）
const { sessionsLoginMock, loginHookOptions } = vi.hoisted(() => ({
  sessionsLoginMock: vi.fn(),
  loginHookOptions: { current: undefined as unknown },
}));
vi.mock("../../src/api/endpoints/auth/auth", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/api/endpoints/auth/auth")
  >();
  return {
    ...actual,
    useSessionsLogin: (options?: unknown) => {
      loginHookOptions.current = options;
      return { mutateAsync: sessionsLoginMock };
    },
  };
});

const { authorizeMock, authorizeHookOptions } = vi.hoisted(() => ({
  authorizeMock: vi.fn(),
  authorizeHookOptions: { current: undefined as unknown },
}));
vi.mock("../../src/api/endpoints/oauth/oauth", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("../../src/api/endpoints/oauth/oauth")
  >();
  return {
    ...actual,
    useOAuthAuthorize: (options?: unknown) => {
      authorizeHookOptions.current = options;
      return { mutateAsync: authorizeMock };
    },
  };
});

// mock toast：捕获 toast.error 文案（Toaster 组件随 LoginPage 自挂，mock 成空渲染）
const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: toastError, success: vi.fn() },
  Toaster: () => null,
}));

// Radix DropdownMenu 在 jsdom 下缺 PointerEvent：不 polyfill 时 testing-library 退化为
// 基础 Event，button/pointerType 被 Event 构造器丢弃，Radix 的 whenMouse/button===0
// 判断全挂，菜单永远打不开。补一个最小 PointerEvent（MouseEvent 子类）。
beforeAll(() => {
  if (!window.PointerEvent) {
    class PointerEventPolyfill extends MouseEvent {
      pointerType: string;
      pointerId: number;
      constructor(type: string, params: PointerEventInit = {}) {
        super(type, params);
        this.pointerType = params.pointerType ?? "";
        this.pointerId = params.pointerId ?? 0;
      }
    }
    (window as { PointerEvent?: unknown }).PointerEvent = PointerEventPolyfill;
  }
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.HTMLElement.prototype.hasPointerCapture = () => false;
  window.HTMLElement.prototype.releasePointerCapture = () => {};
});

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
  authorizeMock.mockReset();
  loginHookOptions.current = undefined;
  authorizeHookOptions.current = undefined;
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

// 2026-09-12：登录页「当前后端模式」静态标签 → BackendBadge 切换器
// （dev 诊断工具，不挂功能 ID，与侧边栏 BackendBadge 一致）
describe("登录页 IdP 流程同源钉死", () => {
  it("切换器指向别的后端时，login 仍以页面 origin 为 baseURL（code 不再落别家内存）", async () => {
    // 回归：登录页是 IdP 自己的页面，登录 + authorize 必须打到与页面同源的
    // 后端。此前走全局拦截器 baseURL（读 localStorage 切换器），dev 把切换器
    // 留在 msw 时 authorize 领的 code 落在 msw 内存里，lab RP 拿去配对后端
    // 换 token 必 INVALID_GRANT「code 不存在或已被使用」。
    localStorage.setItem("saas.api.backend", "springboot");
    sessionsLoginMock.mockResolvedValue({ data: LOGIN_RESPONSE });
    renderLogin("/login?client_id=cid-test");
    await fillAndSubmit();
    const opts = loginHookOptions.current as { axios?: { baseURL?: string } };
    expect(opts?.axios?.baseURL).toBe(window.location.origin);
  });

  it("OAuth 跳板分支的 authorize 同样钉同源", async () => {
    localStorage.setItem("saas.api.backend", "msw");
    sessionsLoginMock.mockResolvedValue({ data: LOGIN_RESPONSE });
    authorizeMock.mockResolvedValue({
      data: { code: "c-1", state: "s-1" },
    });
    renderLogin(
      "/login?client_id=cid-test&redirect_uri=" +
        encodeURIComponent("http://localhost:5201/login") +
        "&state=s-1",
    );
    await fillAndSubmit();
    await waitFor(() => expect(authorizeMock).toHaveBeenCalled());
    const opts = authorizeHookOptions.current as { axios?: { baseURL?: string } };
    expect(opts?.axios?.baseURL).toBe(window.location.origin);
  });
});

describe("登录页后端切换器", () => {
  function badgeTrigger(): HTMLElement {
    const badge = screen.getByTestId("backend-badge");
    const btn = badge.querySelector("button");
    expect(btn).toBeTruthy();
    return btn as HTMLElement;
  }

  it("渲染 BackendBadge，未选择时显示 env 默认", () => {
    renderLogin();
    expect(badgeTrigger().textContent).toContain("(env 默认)");
  });

  it("选 springboot -> localStorage 持久化 + 触发按钮显示 springboot", () => {
    renderLogin();
    // jsdom 无 PointerEvent 构造器 -> 事件是基础 Event，button 需显式给（Radix 判 event.button===0）
    fireEvent.pointerDown(badgeTrigger(), { button: 0, ctrlKey: false, pointerType: "mouse" });
    // DropdownMenu 内容挂 document.body（portal），screen 全局查
    fireEvent.click(screen.getByText("springboot"));
    expect(localStorage.getItem("saas.api.backend")).toBe("springboot");
    expect(badgeTrigger().textContent).toContain("springboot");
  });

  it("切回 env 默认 -> localStorage 清除", () => {
    localStorage.setItem("saas.api.backend", "springboot");
    renderLogin();
    expect(badgeTrigger().textContent).toContain("springboot");
    fireEvent.pointerDown(badgeTrigger(), { button: 0, ctrlKey: false, pointerType: "mouse" });
    fireEvent.click(screen.getByText("env 默认（部署配置）"));
    expect(localStorage.getItem("saas.api.backend")).toBeNull();
    expect(badgeTrigger().textContent).toContain("(env 默认)");
  });
});
