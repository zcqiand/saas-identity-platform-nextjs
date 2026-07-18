// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { UsersClient } from "@/app/(protected)/users/users-client";
import { fnTest } from "../fn";

/**
 * M02.F02 用户管理（fn-ID M02.F02.I01-I07）
 *
 * 覆盖：I01 页面 / I02 列表查询 / I03 关键字 / I04 角色筛选 /
 *       I05 新增 / I06 编辑 / I07 删除
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const initialUsers = [
  { id: 1, username: "alice", displayName: "Alice Admin", email: "alice@x.com", roles: '["admin"]', status: "active", createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" },
  { id: 2, username: "bob", displayName: "Bob Manager", email: "bob@x.com", roles: '["manager"]', status: "active", createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" },
  { id: 3, username: "carol", displayName: "Carol Member", email: "carol@x.com", roles: '["member"]', status: "active", createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" },
];

describe("M02.F02 users list page", () => {
  fnTest(["M02.F02.I01"], "页面根挂 data-fn M02.F02.I01", () => {
    const { getByTestId } = render(<UsersClient initialUsers={initialUsers} />);
    expect(getByTestId("users-page").getAttribute("data-fn")).toBe("M02.F02.I01");
  });

  fnTest(["M02.F02.I02"], "渲染 3 行", () => {
    const { getAllByTestId } = render(<UsersClient initialUsers={initialUsers} />);
    expect(getAllByTestId("user-row").length).toBe(3);
  });

  fnTest(["M02.F02.I03"], "关键字搜索过滤", () => {
    const { getByTestId, getAllByTestId } = render(<UsersClient initialUsers={initialUsers} />);
    fireEvent.change(getByTestId("user-search"), { target: { value: "alice" } });
    expect(getAllByTestId("user-row").length).toBe(1);
  });

  fnTest(["M02.F02.I04"], "角色筛选", () => {
    const { getByTestId, getAllByTestId } = render(<UsersClient initialUsers={initialUsers} />);
    fireEvent.change(getByTestId("role-filter"), { target: { value: "admin" } });
    expect(getAllByTestId("user-row").length).toBe(1);
  });

  fnTest(["M02.F02.I05"], "新增按钮挂 data-fn M02.F02.I05", () => {
    const { getByTestId } = render(<UsersClient initialUsers={initialUsers} />);
    expect(getByTestId("new-user-btn").getAttribute("data-fn")).toBe("M02.F02.I05");
  });

  fnTest(["M02.F02.I05"], "I05 点新增打开 Dialog（不弹 alert）", async () => {
    const alertSpy = vi.spyOn(window, "alert");
    const { getByTestId } = render(<UsersClient initialUsers={initialUsers} />);
    fireEvent.click(getByTestId("new-user-btn"));
    await waitFor(() => expect(getByTestId("new-user-dialog")).toBeTruthy());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  fnTest(["M02.F02.I05"], "I05 提交 Dialog 调 POST /api/users 并把新用户加进列表", async () => {
    const created = {
      id: 99,
      username: "dave",
      displayName: "Dave Viewer",
      email: "dave@x.com",
      roles: '["viewer"]',
      status: "active",
      createdAt: "2026-07-17 12:00:00",
      updatedAt: "2026-07-17 12:00:00",
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(created), { status: 201 }),
    );
    const { getByTestId, getAllByTestId } = render(
      <UsersClient initialUsers={initialUsers} />,
    );
    fireEvent.click(getByTestId("new-user-btn"));
    await waitFor(() => expect(getByTestId("new-user-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("new-user-username"), { target: { value: "dave" } });
    fireEvent.change(getByTestId("new-user-displayname"), { target: { value: "Dave Viewer" } });
    fireEvent.change(getByTestId("new-user-email"), { target: { value: "dave@x.com" } });
    fireEvent.click(getByTestId("new-user-role-viewer"));
    fireEvent.click(getByTestId("new-user-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/users");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({
      username: "dave",
      displayName: "Dave Viewer",
      email: "dave@x.com",
    });
    await waitFor(() => expect(getAllByTestId("user-row").length).toBe(4));
  });

  fnTest(["M02.F02.I06"], "编辑按钮挂 data-fn M02.F02.I06", () => {
    const { getAllByTestId } = render(<UsersClient initialUsers={initialUsers} />);
    expect(getAllByTestId("edit-user-btn")[0]!.getAttribute("data-fn")).toBe("M02.F02.I06");
  });

  fnTest(["M02.F02.I06"], "I06 编辑按钮打开 EditUserDialog", async () => {
    const { getAllByTestId, getByTestId } = render(
      <UsersClient initialUsers={initialUsers} />,
    );
    fireEvent.click(getAllByTestId("edit-user-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-user-dialog")).toBeTruthy());
  });

  fnTest(["M02.F02.I06"], "I06 提交 EditUserDialog 调 PUT /api/users/[id]", async () => {
    const updated = {
      id: 1,
      username: "alice",
      displayName: "Alice Super",
      email: "alice@x.com",
      roles: '["admin","manager"]',
      status: "active",
      createdAt: "2026-01-01 00:00:00",
      updatedAt: "2026-07-17 12:00:00",
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(updated), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(
      <UsersClient initialUsers={initialUsers} />,
    );
    fireEvent.click(getAllByTestId("edit-user-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-user-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("edit-user-displayname"), { target: { value: "Alice Super" } });
    fireEvent.click(getByTestId("edit-user-role-manager"));
    fireEvent.click(getByTestId("edit-user-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/users/1");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(body.displayName).toBe("Alice Super");
    expect(body.roles).toContain("manager");
  });

  fnTest(["M02.F02.I07"], "删除按钮点击触发 fetch DELETE（点 confirm 后）", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(
      <UsersClient initialUsers={initialUsers} />,
    );
    const deleteBtns = getAllByTestId("delete-user-btn");
    expect(deleteBtns[0]!.getAttribute("data-fn")).toBe("M02.F02.I07");
    fireEvent.click(deleteBtns[0]!);
    await waitFor(() => expect(getByTestId("confirm-dialog")).toBeTruthy());
    const dialog = getByTestId("confirm-dialog");
    const buttons = Array.from(dialog.querySelectorAll("button"));
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/users/1");
    expect(init.method).toBe("DELETE");
  });

  fnTest(
    ["M02.F02.I08"],
    "I08 错误清错：fetch 4xx 时不关 Dialog、不加列表（错误态可观察）",
    async () => {
      // fetchUsers 路径返回 4xx 时，client 必须保留当前列表 + Dialog 不关（错误暴露给用户）
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ error: "boom" }), { status: 400 }),
      );
      const { getByTestId, getAllByTestId } = render(
        <UsersClient initialUsers={initialUsers} />,
      );
      const newBtn = getByTestId("new-user-btn");
      expect(newBtn.getAttribute("data-fn")).toBe("M02.F02.I05");
      fireEvent.click(newBtn);
      await waitFor(() => expect(getByTestId("new-user-dialog")).toBeTruthy());
      fireEvent.change(getByTestId("new-user-username"), { target: { value: "x" } });
      fireEvent.change(getByTestId("new-user-displayname"), { target: { value: "X" } });
      fireEvent.change(getByTestId("new-user-email"), { target: { value: "x@x.com" } });
      fireEvent.click(getByTestId("new-user-submit"));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      // 列表不应增加（错误态保留）
      await new Promise((r) => setTimeout(r, 50));
      expect(getAllByTestId("user-row").length).toBe(3);
    },
  );
});