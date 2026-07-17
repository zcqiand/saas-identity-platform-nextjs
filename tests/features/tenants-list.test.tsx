// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { TenantsClient } from "@/app/(protected)/tenants/tenants-client";
import * as tenantStore from "@/lib/tenant-store";
import { fnTest } from "../fn";

/**
 * M01.F01 多租户切换 — 租户列表页（fn-ID M01.F01.I01-I05）
 *
 * 覆盖：
 *   - I01 页面根挂 data-fn
 *   - I02 租户查询（搜索框，change 触发 filter）
 *   - I03 新增租户（按钮挂 data-fn）
 *   - I04 查看详情（按钮挂 data-fn）
 *   - I05 删除租户（按钮点击触发 fetch DELETE）
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  tenantStore.setCurrentTenant(0);
  // jsdom 默认 confirm/alert 是 noop；测试需要 confirm 返回 true
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const initialTenants = [
  { id: 1, code: "acme", name: "Acme Corp", theme: "default", createdAt: "2026-01-01 00:00:00" },
  { id: 2, code: "globex", name: "Globex Inc", theme: "dark", createdAt: "2026-01-01 00:00:00" },
  { id: 3, code: "initech", name: "Initech LLC", theme: "light", createdAt: "2026-01-01 00:00:00" },
];

describe("M01.F01 tenants list page", () => {
  fnTest(["M01.F01.I01"], "I01 page root 挂 data-fn M01.F01.I01", () => {
    const { getByTestId } = render(<TenantsClient initialTenants={initialTenants} />);
    expect(getByTestId("tenants-page").getAttribute("data-fn")).toBe("M01.F01.I01");
  });

  fnTest(["M01.F01.I01"], "渲染全部 3 行", () => {
    const { getAllByTestId } = render(<TenantsClient initialTenants={initialTenants} />);
    const rows = getAllByTestId("tenant-row");
    expect(rows.length).toBe(3);
  });

  fnTest(["M01.F01.I02"], "I02 搜索框过滤租户", () => {
    const { getByTestId, getAllByTestId } = render(<TenantsClient initialTenants={initialTenants} />);
    const search = getByTestId("tenant-search");
    fireEvent.change(search, { target: { value: "glob" } });
    expect(getAllByTestId("tenant-row").length).toBe(1);
  });

  fnTest(["M01.F01.I03"], "I03 新增按钮挂 data-fn M01.F01.I03", () => {
    const { getByTestId } = render(<TenantsClient initialTenants={initialTenants} />);
    expect(getByTestId("new-tenant-btn").getAttribute("data-fn")).toBe("M01.F01.I03");
  });

  fnTest(["M01.F01.I03"], "I03 点新增打开 Dialog（不弹 alert）", async () => {
    const alertSpy = vi.spyOn(window, "alert");
    const { getByTestId } = render(<TenantsClient initialTenants={initialTenants} />);
    fireEvent.click(getByTestId("new-tenant-btn"));
    await waitFor(() => {
      expect(getByTestId("new-tenant-dialog")).toBeTruthy();
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  fnTest(["M01.F01.I03"], "I03 提交 Dialog 调 POST /api/tenants 并把新租户加进列表", async () => {
    const newTenant = {
      id: 99,
      code: "hooli",
      name: "Hooli",
      theme: "default",
      createdAt: "2026-07-17 12:00:00",
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(newTenant), { status: 201 }),
    );
    const { getByTestId, getAllByTestId, queryByTestId } = render(
      <TenantsClient initialTenants={initialTenants} />,
    );
    fireEvent.click(getByTestId("new-tenant-btn"));
    await waitFor(() => expect(getByTestId("new-tenant-dialog")).toBeTruthy());

    fireEvent.change(getByTestId("new-tenant-code"), { target: { value: "hooli" } });
    fireEvent.change(getByTestId("new-tenant-name"), { target: { value: "Hooli" } });
    fireEvent.change(getByTestId("new-tenant-theme"), { target: { value: "default" } });
    fireEvent.click(getByTestId("new-tenant-submit"));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/tenants");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({
      code: "hooli",
      name: "Hooli",
      theme: "default",
    });

    await waitFor(() => expect(getAllByTestId("tenant-row").length).toBe(4));
    await waitFor(() => expect(queryByTestId("new-tenant-dialog")).toBeNull());
  });

  fnTest(["M01.F01.I04"], "I04 查看按钮是 Link，href 指向 /tenants/[id]", () => {
    const { getAllByTestId } = render(<TenantsClient initialTenants={initialTenants} />);
    const viewBtn = getAllByTestId("view-tenant-btn")[0]!;
    expect(viewBtn.getAttribute("href")).toBe("/tenants/1");
    expect(viewBtn.getAttribute("data-fn")).toBe("M01.F01.I04");
  });

  fnTest(["M01.F01.I09"], "I09 切换租户打开 Dialog（不弹 alert）", async () => {
    const alertSpy = vi.spyOn(window, "alert");
    const { getByTestId } = render(<TenantsClient initialTenants={initialTenants} />);
    fireEvent.click(getByTestId("switch-tenant-btn"));
    await waitFor(() => {
      expect(getByTestId("switch-tenant-dialog")).toBeTruthy();
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  fnTest(["M01.F01.I09"], "I09 切换 Dialog 含租户 select 选项（3 个）", async () => {
    const { getByTestId } = render(<TenantsClient initialTenants={initialTenants} />);
    fireEvent.click(getByTestId("switch-tenant-btn"));
    await waitFor(() => expect(getByTestId("switch-tenant-dialog")).toBeTruthy());
    // 用 getAllByRole 拿 select 内 option
    const select = getByTestId("switch-tenant-select") as HTMLSelectElement;
    expect(select.options.length).toBe(3);
    expect(select.options[0]!.text).toContain("Acme");
    expect(select.options[1]!.text).toContain("Globex");
    expect(select.options[2]!.text).toContain("Initech");
  });

  fnTest(["M01.F01.I09"], "I09 提交切换调 POST /api/tenants/switch", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ currentTenantId: 2 }), { status: 200 }),
    );
    const { getByTestId, queryByTestId } = render(
      <TenantsClient initialTenants={initialTenants} />,
    );
    fireEvent.click(getByTestId("switch-tenant-btn"));
    await waitFor(() => expect(getByTestId("switch-tenant-dialog")).toBeTruthy());

    const select = getByTestId("switch-tenant-select") as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "2" } });
    fireEvent.click(getByTestId("switch-tenant-submit"));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/tenants/switch");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ tenantId: 2 });
    await waitFor(() => expect(queryByTestId("switch-tenant-dialog")).toBeNull());
  });

  fnTest(["M01.F01.I05"], "I05 删除按钮点击触发 fetch DELETE（点 confirm 后）", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(
      <TenantsClient initialTenants={initialTenants} />,
    );
    const deleteBtns = getAllByTestId("delete-tenant-btn");
    expect(deleteBtns[0]!.getAttribute("data-fn")).toBe("M01.F01.I05");

    fireEvent.click(deleteBtns[0]!);
    await waitFor(() => expect(getByTestId("confirm-dialog")).toBeTruthy());
    const dialog = getByTestId("confirm-dialog");
    const buttons = Array.from(dialog.querySelectorAll("button"));
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/tenants/1");
    expect(init.method).toBe("DELETE");
  });
});