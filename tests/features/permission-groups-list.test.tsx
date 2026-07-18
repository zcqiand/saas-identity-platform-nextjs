// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { PermissionGroupsClient } from "@/app/(protected)/permission-groups/permission-groups-client";
import { fnTest } from "../fn";

/**
 * M03.F02 权限组管理（fn-ID M03.F02.I01-I04）
 *
 * 覆盖：I01 页面根 / I02 新建 / I03 编辑 / I04 删除
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const initialGroups = [
  {
    id: 1,
    name: "admin-pack",
    description: "管理员全部权限",
    permissions: '["user:read","user:write"]',
    sort: 0,
    enabled: true,
    createdAt: "2026-01-01 00:00:00",
    updatedAt: "2026-01-01 00:00:00",
  },
  {
    id: 2,
    name: "read-pack",
    description: "只读",
    permissions: '["user:read"]',
    sort: 1,
    enabled: true,
    createdAt: "2026-01-01 00:00:00",
    updatedAt: "2026-01-01 00:00:00",
  },
];

describe("M03.F02 permission groups page", () => {
  fnTest(["M03.F02.I01"], "页面根挂 data-fn M03.F02.I01", () => {
    const { getByTestId } = render(
      <PermissionGroupsClient initialGroups={initialGroups} />,
    );
    expect(
      getByTestId("permission-groups-page").getAttribute("data-fn"),
    ).toBe("M03.F02.I01");
  });

  fnTest(["M03.F02.I01"], "渲染 2 行", () => {
    const { getAllByTestId } = render(
      <PermissionGroupsClient initialGroups={initialGroups} />,
    );
    expect(getAllByTestId("perm-group-row").length).toBe(2);
  });

  fnTest(["M03.F02.I02"], "I02 新建按钮挂 data-fn M03.F02.I02", () => {
    const { getByTestId } = render(
      <PermissionGroupsClient initialGroups={initialGroups} />,
    );
    expect(getByTestId("new-perm-group-btn").getAttribute("data-fn")).toBe(
      "M03.F02.I02",
    );
  });

  fnTest(["M03.F02.I02"], "I02 点新建打开 Dialog", async () => {
    const { getByTestId } = render(
      <PermissionGroupsClient initialGroups={initialGroups} />,
    );
    fireEvent.click(getByTestId("new-perm-group-btn"));
    await waitFor(() => expect(getByTestId("new-perm-group-dialog")).toBeTruthy());
  });

  fnTest(
    ["M03.F02.I02"],
    "I02 提交 Dialog 调 POST /api/permission-groups 并把新组加进列表",
    async () => {
      const created = {
        id: 99,
        name: "qa-pack",
        description: null,
        permissions: '["qa:run"]',
        sort: 0,
        enabled: true,
        createdAt: "2026-07-17 12:00:00",
        updatedAt: "2026-07-17 12:00:00",
      };
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify(created), { status: 201 }),
      );
      const { getByTestId, getAllByTestId } = render(
        <PermissionGroupsClient initialGroups={initialGroups} />,
      );
      fireEvent.click(getByTestId("new-perm-group-btn"));
      await waitFor(() =>
        expect(getByTestId("new-perm-group-dialog")).toBeTruthy(),
      );
      fireEvent.change(getByTestId("new-perm-group-name"), {
        target: { value: "qa-pack" },
      });
      fireEvent.change(getByTestId("new-perm-group-permissions"), {
        target: { value: "qa:run" },
      });
      fireEvent.click(getByTestId("new-perm-group-submit"));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/permission-groups");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body as string);
      expect(body.name).toBe("qa-pack");
      expect(body.permissions).toEqual(["qa:run"]);
      await waitFor(() =>
        expect(getAllByTestId("perm-group-row").length).toBe(3),
      );
    },
  );

  fnTest(["M03.F02.I03"], "I03 编辑按钮打开 EditPermGroupDialog", async () => {
    const { getAllByTestId, getByTestId } = render(
      <PermissionGroupsClient initialGroups={initialGroups} />,
    );
    fireEvent.click(getAllByTestId("edit-perm-group-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-perm-group-dialog")).toBeTruthy());
  });

  fnTest(
    ["M03.F02.I03"],
    "I03 提交 EditPermGroupDialog 调 PUT /api/permission-groups/[id]",
    async () => {
      const updated = {
        ...initialGroups[0]!,
        description: "管理员更新",
        updatedAt: "2026-07-17 12:00:00",
      };
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify(updated), { status: 200 }),
      );
      const { getAllByTestId, getByTestId } = render(
        <PermissionGroupsClient initialGroups={initialGroups} />,
      );
      fireEvent.click(getAllByTestId("edit-perm-group-btn")[0]!);
      await waitFor(() =>
        expect(getByTestId("edit-perm-group-dialog")).toBeTruthy(),
      );
      fireEvent.change(getByTestId("edit-perm-group-description"), {
        target: { value: "管理员更新" },
      });
      fireEvent.click(getByTestId("edit-perm-group-submit"));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/permission-groups/1");
      expect(init.method).toBe("PUT");
      expect(JSON.parse(init.body as string).description).toBe("管理员更新");
    },
  );

  fnTest(
    ["M03.F02.I04"],
    "I04 删除按钮点击触发 fetch DELETE（点 confirm 后）",
    async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ deleted: true }), { status: 200 }),
      );
      const { getAllByTestId, getByTestId } = render(
        <PermissionGroupsClient initialGroups={initialGroups} />,
      );
      const deleteBtns = getAllByTestId("delete-perm-group-btn");
      expect(deleteBtns[0]!.getAttribute("data-fn")).toBe("M03.F02.I04");
      fireEvent.click(deleteBtns[0]!);
      await waitFor(() => expect(getByTestId("confirm-dialog")).toBeTruthy());
      const dialog = getByTestId("confirm-dialog");
      const buttons = Array.from(dialog.querySelectorAll("button"));
      fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe("/api/permission-groups/1");
      expect(init.method).toBe("DELETE");
    },
  );
});