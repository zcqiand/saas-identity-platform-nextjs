// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { MenusClient } from "@/app/(protected)/apps/[id]/menus/menus-client";
import { fnTest } from "../fn";

/**
 * M04.F01 应用菜单（fn-ID M04.F01.I07-I11）
 *
 * 覆盖：I07 页面根 / I08 新建根菜单 / I09 新建子菜单 / I10 编辑 / I11 删除
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const initialMenus = [
  { id: 1, appId: 1, parentId: null, code: "overview", name: "总览", path: "/dashboard", sort: 0, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00", depth: 0 },
  { id: 2, appId: 1, parentId: 1, code: "metrics", name: "指标", path: "/dashboard/metrics", sort: 0, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00", depth: 1 },
];

describe("M04.F01 menus page", () => {
  fnTest(["M04.F01.I07"], "页面根挂 data-fn M04.F01.I07", () => {
    const { getByTestId } = render(
      <MenusClient appId={1} appName="数据看板" initialMenus={initialMenus} />,
    );
    expect(getByTestId("menus-page").getAttribute("data-fn")).toBe("M04.F01.I07");
  });

  fnTest(["M04.F01.I08"], "I08 新建根菜单按钮挂 data-fn M04.F01.I08", () => {
    const { getByTestId } = render(
      <MenusClient appId={1} appName="数据看板" initialMenus={initialMenus} />,
    );
    expect(getByTestId("new-menu-btn").getAttribute("data-fn")).toBe("M04.F01.I08");
  });

  fnTest(["M04.F01.I09"], "I09 新建子菜单按钮挂 data-fn M04.F01.I09", () => {
    const { getAllByTestId } = render(
      <MenusClient appId={1} appName="数据看板" initialMenus={initialMenus} />,
    );
    expect(getAllByTestId("new-child-menu-btn")[0]!.getAttribute("data-fn")).toBe(
      "M04.F01.I09",
    );
  });

  fnTest(["M04.F01.I08"], "I08 点新建根菜单打开 Dialog", async () => {
    const { getByTestId } = render(
      <MenusClient appId={1} appName="数据看板" initialMenus={initialMenus} />,
    );
    fireEvent.click(getByTestId("new-menu-btn"));
    await waitFor(() => expect(getByTestId("new-menu-dialog")).toBeTruthy());
  });

  fnTest(["M04.F01.I08"], "I08 提交 Dialog 调 POST /api/menus (parentId=null)", async () => {
    const created = {
      id: 99,
      appId: 1,
      parentId: null,
      code: "alerts",
      name: "告警",
      path: "/dashboard/alerts",
      sort: 0,
      enabled: true,
      createdAt: "2026-07-18 12:00:00",
      updatedAt: "2026-07-18 12:00:00",
      depth: 0,
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(created), { status: 201 }),
    );
    const { getByTestId, getAllByTestId } = render(
      <MenusClient appId={1} appName="数据看板" initialMenus={initialMenus} />,
    );
    fireEvent.click(getByTestId("new-menu-btn"));
    await waitFor(() => expect(getByTestId("new-menu-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("new-menu-code"), { target: { value: "alerts" } });
    fireEvent.change(getByTestId("new-menu-name"), { target: { value: "告警" } });
    fireEvent.change(getByTestId("new-menu-path"), { target: { value: "/dashboard/alerts" } });
    fireEvent.click(getByTestId("new-menu-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/menus");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string).appId).toBe(1);
    expect(JSON.parse(init.body as string).parentId).toBeNull();
    await waitFor(() => expect(getAllByTestId("menu-row").length).toBe(3));
  });

  fnTest(["M04.F01.I10"], "I10 编辑按钮打开 EditMenuDialog", async () => {
    const { getAllByTestId, getByTestId } = render(
      <MenusClient appId={1} appName="数据看板" initialMenus={initialMenus} />,
    );
    fireEvent.click(getAllByTestId("edit-menu-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-menu-dialog")).toBeTruthy());
  });

  fnTest(["M04.F01.I10"], "I10 提交 EditMenuDialog 调 PUT /api/menus/[id]", async () => {
    const updated = {
      id: 1,
      appId: 1,
      parentId: null,
      code: "overview",
      name: "总览 v2",
      path: "/dashboard",
      sort: 0,
      enabled: true,
      createdAt: "2026-01-01 00:00:00",
      updatedAt: "2026-07-18 12:00:00",
      depth: 0,
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(updated), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(
      <MenusClient appId={1} appName="数据看板" initialMenus={initialMenus} />,
    );
    fireEvent.click(getAllByTestId("edit-menu-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-menu-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("edit-menu-name"), { target: { value: "总览 v2" } });
    fireEvent.click(getByTestId("edit-menu-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/menus/1");
    expect(init.method).toBe("PUT");
  });

  fnTest(["M04.F01.I11"], "I11 删除按钮点击触发 fetch DELETE（点 confirm 后）", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(
      <MenusClient appId={1} appName="数据看板" initialMenus={initialMenus} />,
    );
    const deleteBtns = getAllByTestId("delete-menu-btn");
    expect(deleteBtns[0]!.getAttribute("data-fn")).toBe("M04.F01.I11");
    fireEvent.click(deleteBtns[0]!);
    await waitFor(() => expect(getByTestId("confirm-dialog")).toBeTruthy());
    const dialog = getByTestId("confirm-dialog");
    const buttons = Array.from(dialog.querySelectorAll("button"));
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/menus/1");
    expect(init.method).toBe("DELETE");
  });
});