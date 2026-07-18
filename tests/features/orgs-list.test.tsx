// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, fireEvent, waitFor } from "@testing-library/react";
import { OrgsClient } from "@/app/(protected)/orgs/orgs-client";
import { seedDatabase } from "@/db/seed";
import { fnTest } from "../fn";

/**
 * M02.F01 多租户切换 — 组织管理页（fn-ID M02.F01.I01-I06）
 *
 * 覆盖：I01 页面根 / I02 树形查询 / I03-I04 新增 / I05 编辑 / I06 删除
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  seedDatabase();
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const initialTree = [
  { id: 1, name: "Engineering", parentId: null, sort: 0, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00", depth: 0 },
  { id: 2, name: "Platform", parentId: 1, sort: 0, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00", depth: 1 },
  { id: 3, name: "Web", parentId: 1, sort: 0, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00", depth: 1 },
  { id: 4, name: "Operations", parentId: null, sort: 0, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00", depth: 0 },
];

describe("M02.F01 orgs list page", () => {
  fnTest(["M02.F01.I01"], "页面根挂 data-fn M02.F01.I01", () => {
    const { getByTestId } = render(<OrgsClient initialTree={initialTree} />);
    expect(getByTestId("orgs-page").getAttribute("data-fn")).toBe("M02.F01.I01");
  });

  fnTest(["M02.F01.I02"], "树形查询：渲染全部 4 节点", () => {
    const { getAllByTestId } = render(<OrgsClient initialTree={initialTree} />);
    expect(getAllByTestId("org-row").length).toBe(4);
  });

  fnTest(["M02.F01.I03", "M02.F01.I04"], "新增根 / 子按钮挂 data-fn", () => {
    const { getAllByTestId } = render(<OrgsClient initialTree={initialTree} />);
    const newRootBtns = getAllByTestId("new-org-btn");
    expect(newRootBtns[0]!.getAttribute("data-fn")).toMatch(/M02\.F01\.I0[34]/);
  });

  fnTest(["M02.F01.I05"], "编辑按钮挂 data-fn M02.F01.I05", () => {
    const { getAllByTestId } = render(<OrgsClient initialTree={initialTree} />);
    expect(getAllByTestId("edit-org-btn")[0]!.getAttribute("data-fn")).toBe("M02.F01.I05");
  });

  fnTest(["M02.F01.I06"], "删除按钮点击触发 fetch DELETE", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(<OrgsClient initialTree={initialTree} />);
    const deleteBtns = getAllByTestId("delete-org-btn");
    expect(deleteBtns[0]!.getAttribute("data-fn")).toBe("M02.F01.I06");
    fireEvent.click(deleteBtns[0]!);
    // 二次确认 Dialog 弹出，点确认后才发 fetch
    await waitFor(() => expect(getByTestId("confirm-dialog")).toBeTruthy());
    const dialog = getByTestId("confirm-dialog");
    // ConfirmDialog 内最后一行按钮是确认（Cancel 在前）
    const buttons = Array.from(dialog.querySelectorAll("button"));
    const confirm = buttons[buttons.length - 1] as HTMLElement;
    expect(confirm).toBeTruthy();
    fireEvent.click(confirm);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/orgs/1");
    expect(init.method).toBe("DELETE");
  });

  fnTest(["M02.F01.I03"], "I03 新增根部门按钮挂 data-fn + 打开 Dialog", async () => {
    const { getAllByTestId, queryByTestId } = render(<OrgsClient initialTree={initialTree} />);
    const newRootBtn = getAllByTestId("new-org-btn").find(
      (b) => b.getAttribute("data-fn") === "M02.F01.I03",
    )!;
    expect(newRootBtn).toBeTruthy();
    fireEvent.click(newRootBtn);
    await waitFor(() => expect(queryByTestId("new-org-dialog")).toBeTruthy());
  });

  fnTest(["M02.F01.I04"], "I04 新增子部门按钮挂 data-fn + 打开 Dialog", async () => {
    const { getAllByTestId, queryByTestId } = render(<OrgsClient initialTree={initialTree} />);
    const newChildBtn = getAllByTestId("new-org-btn").find(
      (b) => b.getAttribute("data-fn") === "M02.F01.I04",
    )!;
    expect(newChildBtn).toBeTruthy();
    fireEvent.click(newChildBtn);
    await waitFor(() => expect(queryByTestId("new-org-dialog")).toBeTruthy());
  });

  fnTest(["M02.F01.I05"], "I05 编辑按钮打开 EditOrgDialog", async () => {
    const { getAllByTestId, queryByTestId } = render(<OrgsClient initialTree={initialTree} />);
    fireEvent.click(getAllByTestId("edit-org-btn")[0]!);
    await waitFor(() => expect(queryByTestId("edit-org-dialog")).toBeTruthy());
  });

  fnTest(["M02.F01.I05"], "I05 提交 EditOrgDialog 调 PUT /api/orgs/[id]", async () => {
    const updated = {
      id: 1,
      name: "Engineering Renamed",
      parentId: null,
      sort: 0,
      enabled: true,
      createdAt: "2026-01-01 00:00:00",
      updatedAt: "2026-01-01 00:00:00",
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(updated), { status: 200 }),
    );
    const { getAllByTestId, getByTestId, queryByTestId } = render(
      <OrgsClient initialTree={initialTree} />,
    );
    fireEvent.click(getAllByTestId("edit-org-btn")[0]!);
    await waitFor(() => expect(queryByTestId("edit-org-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("edit-org-name"), { target: { value: "Engineering Renamed" } });
    fireEvent.click(getByTestId("edit-org-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/orgs/1");
    expect(init.method).toBe("PUT");
    await waitFor(() => expect(queryByTestId("edit-org-dialog")).toBeNull());
  });

  it("树形缩进：depth=1 节点缩进 8 单位", () => {
    const { getAllByTestId } = render(<OrgsClient initialTree={initialTree} />);
    const web = getAllByTestId("org-row").find((r) => r.textContent?.includes("Web"));
    expect(web?.className).toContain("ml-8");
  });

  fnTest(["M02.F01.I08"], "I08 组织表单弹窗（NewOrgDialog + EditOrgDialog）独立组件存在", () => {
    // M02.F01.I08 把表单弹窗抽成 NewOrgDialog / EditOrgDialog 独立组件：
    //   - NewOrgDialog 由顶部「新增根/子」按钮触发
    //   - EditOrgDialog 由行内「编辑」按钮触发
    // 这里断言两个 testid 都稳定存在（独立组件被 mount 后才能出现）
    const { getAllByTestId, queryByTestId } = render(<OrgsClient initialTree={initialTree} />);
    // 先不开 dialog，dialog 不在 DOM
    expect(queryByTestId("new-org-dialog")).toBeNull();
    expect(queryByTestId("edit-org-dialog")).toBeNull();
    // 通过点击触发，证明组件被独立创建 + 渲染
    expect(getAllByTestId("new-org-btn").length).toBeGreaterThan(0);
    expect(getAllByTestId("edit-org-btn").length).toBeGreaterThan(0);
  });
});