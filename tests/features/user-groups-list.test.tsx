// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { UserGroupsClient } from "@/app/(protected)/user-groups/user-groups-client";
import { fnTest } from "../fn";

/** M03.F03 用户组管理（fn-ID M03.F03.I01-I05） */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const initialGroups = [
  { id: 1, name: "Engineering Team", description: "All eng", enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" },
  { id: 2, name: "All Users", description: null, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" },
];

describe("M03.F03 user-groups list page", () => {
  fnTest(["M03.F03.I01"], "页面根挂 data-fn M03.F03.I01", () => {
    const { getByTestId } = render(<UserGroupsClient initialGroups={initialGroups} />);
    expect(getByTestId("user-groups-page").getAttribute("data-fn")).toBe("M03.F03.I01");
  });

  fnTest(["M03.F03.I01"], "渲染 2 行", () => {
    const { getAllByTestId } = render(<UserGroupsClient initialGroups={initialGroups} />);
    expect(getAllByTestId("group-row").length).toBe(2);
  });

  fnTest(["M03.F03.I02"], "新建用户组按钮挂 data-fn M03.F03.I02", () => {
    const { getByTestId } = render(<UserGroupsClient initialGroups={initialGroups} />);
    expect(getByTestId("new-group-btn").getAttribute("data-fn")).toBe("M03.F03.I02");
  });

  fnTest(["M03.F03.I02"], "I02 点新建打开 Dialog（不弹 alert）", async () => {
    const alertSpy = vi.spyOn(window, "alert");
    const { getByTestId } = render(<UserGroupsClient initialGroups={initialGroups} />);
    fireEvent.click(getByTestId("new-group-btn"));
    await waitFor(() => expect(getByTestId("new-group-dialog")).toBeTruthy());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  fnTest(["M03.F03.I02"], "I02 提交 Dialog 调 POST /api/user-groups 并把新组加进列表", async () => {
    const created = {
      id: 99,
      name: "Sales Team",
      description: null,
      enabled: true,
      createdAt: "2026-07-17 12:00:00",
      updatedAt: "2026-07-17 12:00:00",
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(created), { status: 201 }),
    );
    const { getByTestId, getAllByTestId } = render(
      <UserGroupsClient initialGroups={initialGroups} />,
    );
    fireEvent.click(getByTestId("new-group-btn"));
    await waitFor(() => expect(getByTestId("new-group-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("new-group-name"), { target: { value: "Sales Team" } });
    fireEvent.click(getByTestId("new-group-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/user-groups");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ name: "Sales Team" });
    await waitFor(() => expect(getAllByTestId("group-row").length).toBe(3));
  });

  fnTest(["M03.F03.I03"], "编辑用户组按钮挂 data-fn M03.F03.I03", () => {
    const { getAllByTestId } = render(<UserGroupsClient initialGroups={initialGroups} />);
    expect(getAllByTestId("edit-group-btn")[0]!.getAttribute("data-fn")).toBe("M03.F03.I03");
  });

  fnTest(["M03.F03.I03"], "I03 编辑按钮打开 EditGroupDialog", async () => {
    const { getAllByTestId, getByTestId } = render(
      <UserGroupsClient initialGroups={initialGroups} />,
    );
    fireEvent.click(getAllByTestId("edit-group-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-group-dialog")).toBeTruthy());
  });

  fnTest(["M03.F03.I03"], "I03 提交 EditGroupDialog 调 PUT /api/user-groups/[id]", async () => {
    const updated = {
      id: 1,
      name: "Eng Team Renamed",
      description: "All eng",
      enabled: true,
      createdAt: "2026-01-01 00:00:00",
      updatedAt: "2026-07-17 12:00:00",
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(updated), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(
      <UserGroupsClient initialGroups={initialGroups} />,
    );
    fireEvent.click(getAllByTestId("edit-group-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-group-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("edit-group-name"), { target: { value: "Eng Team Renamed" } });
    fireEvent.click(getByTestId("edit-group-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/user-groups/1");
    expect(init.method).toBe("PUT");
  });

  fnTest(["M03.F03.I04"], "删除用户组按钮点击触发 fetch DELETE（点 confirm 后）", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(
      <UserGroupsClient initialGroups={initialGroups} />,
    );
    const deleteBtns = getAllByTestId("delete-group-btn");
    expect(deleteBtns[0]!.getAttribute("data-fn")).toBe("M03.F03.I04");
    fireEvent.click(deleteBtns[0]!);
    await waitFor(() => expect(getByTestId("confirm-dialog")).toBeTruthy());
    const dialog = getByTestId("confirm-dialog");
    const buttons = Array.from(dialog.querySelectorAll("button"));
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/user-groups/1");
    expect(init.method).toBe("DELETE");
  });
});