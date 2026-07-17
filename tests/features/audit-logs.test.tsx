// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { AuditLogsClient } from "@/app/(protected)/audit-logs/audit-logs-client";
import { fnTest } from "../fn";

/**
 * M05.F01 审计日志（fn-ID M05.F01.I01-I07）
 *
 * 覆盖：I01 页面根 / I02-I05 四个 Tab / I06 搜索 / I07 导出 CSV
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const initialLogs = [
  { id: 1, action: "login", operator: "alice", resource: "session", resourceId: "s-1", ip: "127.0.0.1", detail: "", timestamp: "2026-07-18 10:00:00" },
  { id: 2, action: "create", operator: "bob", resource: "role", resourceId: "r-1", ip: "127.0.0.1", detail: "new role", timestamp: "2026-07-18 10:01:00" },
  { id: 3, action: "permission_change", operator: "admin", resource: "role", resourceId: "r-2", ip: "127.0.0.1", detail: "added user:read", timestamp: "2026-07-18 10:02:00" },
];

describe("M05.F01 audit logs page", () => {
  fnTest(["M05.F01.I01"], "页面根挂 data-fn M05.F01.I01", () => {
    const { getByTestId } = render(<AuditLogsClient initialLogs={initialLogs} />);
    expect(getByTestId("audit-logs-page").getAttribute("data-fn")).toBe("M05.F01.I01");
  });

  fnTest(["M05.F01.I01"], "初始渲染 3 行", () => {
    const { getAllByTestId } = render(<AuditLogsClient initialLogs={initialLogs} />);
    expect(getAllByTestId("audit-log-row").length).toBe(3);
  });

  fnTest(["M05.F01.I02"], "I02 全部 Tab 挂 data-fn M05.F01.I02", () => {
    const { getByTestId } = render(<AuditLogsClient initialLogs={initialLogs} />);
    expect(getByTestId("audit-tab-all").getAttribute("data-fn")).toBe("M05.F01.I02");
  });

  fnTest(["M05.F01.I03"], "I03 登录日志 Tab 挂 data-fn M05.F01.I03", () => {
    const { getByTestId } = render(<AuditLogsClient initialLogs={initialLogs} />);
    expect(getByTestId("audit-tab-login").getAttribute("data-fn")).toBe("M05.F01.I03");
  });

  fnTest(["M05.F01.I04"], "I04 操作日志 Tab 挂 data-fn M05.F01.I04", () => {
    const { getByTestId } = render(<AuditLogsClient initialLogs={initialLogs} />);
    expect(getByTestId("audit-tab-operation").getAttribute("data-fn")).toBe("M05.F01.I04");
  });

  fnTest(["M05.F01.I05"], "I05 安全日志 Tab 挂 data-fn M05.F01.I05", () => {
    const { getByTestId } = render(<AuditLogsClient initialLogs={initialLogs} />);
    expect(getByTestId("audit-tab-security").getAttribute("data-fn")).toBe("M05.F01.I05");
  });

  fnTest(["M05.F01.I03"], "I03 切换登录 Tab 调 GET /api/audit-logs?tab=login", async () => {
    const filtered = [initialLogs[0]!];
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(filtered), { status: 200 }),
    );
    const { getByTestId, getAllByTestId } = render(
      <AuditLogsClient initialLogs={initialLogs} />,
    );
    fireEvent.click(getByTestId("audit-tab-login"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1] as [string];
    expect(lastCall[0]).toContain("/api/audit-logs");
    expect(lastCall[0]).toContain("tab=login");
    await waitFor(() => expect(getAllByTestId("audit-log-row").length).toBe(1));
  });

  fnTest(["M05.F01.I06"], "I06 查询按钮带 operator 参数调 GET /api/audit-logs", async () => {
    const filtered = [initialLogs[0]!];
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(filtered), { status: 200 }),
    );
    const { getByTestId } = render(<AuditLogsClient initialLogs={initialLogs} />);
    fireEvent.change(getByTestId("audit-operator-search"), {
      target: { value: "alice" },
    });
    // 点查询按钮（搜索框旁 Button，是 tabs 同级 Card 内的第二个 button）
    const buttons = Array.from(document.querySelectorAll("button"));
    const queryBtn = buttons.find((b) => b.textContent?.includes("查询"));
    expect(queryBtn).toBeTruthy();
    fireEvent.click(queryBtn!);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const lastCall = fetchSpy.mock.calls[fetchSpy.mock.calls.length - 1] as [string];
    expect(lastCall[0]).toContain("operator=alice");
  });

  fnTest(["M05.F01.I07"], "I07 导出按钮调 POST /api/audit-logs", async () => {
    // mount 时 useEffect 会发一次 GET；mock 也要响应它
    const csvSpy = vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = typeof input === "string" ? input : (input as Request).url;
      if (url.endsWith("/api/audit-logs") || url.includes("/api/audit-logs?")) {
        return new Response("[]", { status: 200 });
      }
      return new Response("id,action\n1,login", { status: 200 });
    });
    // 模拟 createObjectURL / anchor.click
    const createObjectURL = vi.fn(() => "blob:fake");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      value: createObjectURL,
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      value: revokeObjectURL,
      writable: true,
    });
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    const { getByTestId } = render(<AuditLogsClient initialLogs={initialLogs} />);
    fireEvent.click(getByTestId("export-audit-csv-btn"));
    await waitFor(() => expect(csvSpy).toHaveBeenCalled());
    // 找到 POST 那个调用
    const postCall = csvSpy.mock.calls.find(
      (call) => {
        const init = call[1] as RequestInit | undefined;
        return init != null && init.method === "POST";
      },
    ) as [string, RequestInit] | undefined;
    expect(postCall).toBeTruthy();
    expect(postCall![0]).toBe("/api/audit-logs");
    expect(clickSpy).toHaveBeenCalled();

    clickSpy.mockRestore();
  });
});