// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { AppsClient } from "@/app/(protected)/apps/apps-client";
import { fnTest } from "../fn";

/**
 * M04.F01 应用管理（fn-ID M04.F01.I01-I06）
 *
 * 覆盖：I01 页面根 / I02 搜索 / I03 新建 / I04 编辑 / I05 删除 / I06 跳转菜单
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const initialApps = [
  { id: 1, code: "dashboard", name: "数据看板", type: "web", description: null, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" },
  { id: 2, code: "billing", name: "计费系统", type: "web", description: null, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" },
];

describe("M04.F01 apps list page", () => {
  fnTest(["M04.F01.I01"], "页面根挂 data-fn M04.F01.I01", () => {
    const { getByTestId } = render(<AppsClient initialApps={initialApps} />);
    expect(getByTestId("apps-page").getAttribute("data-fn")).toBe("M04.F01.I01");
  });

  fnTest(["M04.F01.I01"], "渲染 2 行", () => {
    const { getAllByTestId } = render(<AppsClient initialApps={initialApps} />);
    expect(getAllByTestId("app-row").length).toBe(2);
  });

  fnTest(["M04.F01.I02"], "I02 搜索框过滤", () => {
    const { getByTestId, getAllByTestId } = render(<AppsClient initialApps={initialApps} />);
    fireEvent.change(getByTestId("app-search"), { target: { value: "bill" } });
    expect(getAllByTestId("app-row").length).toBe(1);
  });

  fnTest(["M04.F01.I03"], "I03 新建应用按钮挂 data-fn M04.F01.I03", () => {
    const { getByTestId } = render(<AppsClient initialApps={initialApps} />);
    expect(getByTestId("new-app-btn").getAttribute("data-fn")).toBe("M04.F01.I03");
  });

  fnTest(["M04.F01.I03"], "I03 点新建打开 Dialog", async () => {
    const { getByTestId } = render(<AppsClient initialApps={initialApps} />);
    fireEvent.click(getByTestId("new-app-btn"));
    await waitFor(() => expect(getByTestId("new-app-dialog")).toBeTruthy());
  });

  fnTest(["M04.F01.I03"], "I03 提交 Dialog 调 POST /api/apps 并把新应用加进列表", async () => {
    const created = {
      id: 99,
      code: "ci",
      name: "CI 系统",
      type: "web",
      description: null,
      enabled: true,
      createdAt: "2026-07-18 12:00:00",
      updatedAt: "2026-07-18 12:00:00",
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(created), { status: 201 }),
    );
    const { getByTestId, getAllByTestId } = render(<AppsClient initialApps={initialApps} />);
    fireEvent.click(getByTestId("new-app-btn"));
    await waitFor(() => expect(getByTestId("new-app-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("new-app-code"), { target: { value: "ci" } });
    fireEvent.change(getByTestId("new-app-name"), { target: { value: "CI 系统" } });
    fireEvent.click(getByTestId("new-app-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apps");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ code: "ci", name: "CI 系统" });
    await waitFor(() => expect(getAllByTestId("app-row").length).toBe(3));
  });

  fnTest(["M04.F01.I04"], "I04 编辑按钮打开 EditAppDialog", async () => {
    const { getAllByTestId, getByTestId } = render(<AppsClient initialApps={initialApps} />);
    fireEvent.click(getAllByTestId("edit-app-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-app-dialog")).toBeTruthy());
  });

  fnTest(["M04.F01.I04"], "I04 提交 EditAppDialog 调 PUT /api/apps/[id]", async () => {
    const updated = {
      id: 1,
      code: "dashboard",
      name: "数据看板 v2",
      type: "web",
      description: null,
      enabled: true,
      createdAt: "2026-01-01 00:00:00",
      updatedAt: "2026-07-18 12:00:00",
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(updated), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(<AppsClient initialApps={initialApps} />);
    fireEvent.click(getAllByTestId("edit-app-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-app-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("edit-app-name"), { target: { value: "数据看板 v2" } });
    fireEvent.click(getByTestId("edit-app-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apps/1");
    expect(init.method).toBe("PUT");
  });

  fnTest(["M04.F01.I05"], "I05 删除按钮点击触发 fetch DELETE（点 confirm 后）", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(<AppsClient initialApps={initialApps} />);
    const deleteBtns = getAllByTestId("delete-app-btn");
    expect(deleteBtns[0]!.getAttribute("data-fn")).toBe("M04.F01.I05");
    fireEvent.click(deleteBtns[0]!);
    await waitFor(() => expect(getByTestId("confirm-dialog")).toBeTruthy());
    const dialog = getByTestId("confirm-dialog");
    const buttons = Array.from(dialog.querySelectorAll("button"));
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/apps/1");
    expect(init.method).toBe("DELETE");
  });

  fnTest(["M04.F01.I06"], "I06 跳转菜单按钮是 Link，href 指向 /apps/[id]/menus", () => {
    const { getAllByTestId } = render(<AppsClient initialApps={initialApps} />);
    const btn = getAllByTestId("app-menus-btn")[0]!;
    expect(btn.getAttribute("href")).toBe("/apps/1/menus");
    expect(btn.getAttribute("data-fn")).toBe("M04.F01.I06");
  });
});