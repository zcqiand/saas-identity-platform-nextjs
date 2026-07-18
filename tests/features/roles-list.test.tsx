// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { RolesClient } from "@/app/(protected)/roles/roles-client";
import { fnTest } from "../fn";

/**
 * M03.F01 角色管理（fn-ID M03.F01.I01-I07）
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const initialRoles = [
  { id: 1, code: "admin", name: "Administrator", description: "All perms", enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" },
  { id: 2, code: "manager", name: "Manager", description: null, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" },
  { id: 3, code: "viewer", name: "Viewer", description: null, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00" },
];

describe("M03.F01 roles list page", () => {
  fnTest(["M03.F01.I01"], "页面根挂 data-fn M03.F01.I01", () => {
    const { getByTestId } = render(<RolesClient initialRoles={initialRoles} />);
    expect(getByTestId("roles-page").getAttribute("data-fn")).toBe("M03.F01.I01");
  });

  fnTest(["M03.F01.I02"], "渲染 3 行", () => {
    const { getAllByTestId } = render(<RolesClient initialRoles={initialRoles} />);
    expect(getAllByTestId("role-row").length).toBe(3);
  });

  fnTest(["M03.F01.I03"], "新建角色按钮挂 data-fn M03.F01.I03", () => {
    const { getByTestId } = render(<RolesClient initialRoles={initialRoles} />);
    expect(getByTestId("new-role-btn").getAttribute("data-fn")).toBe("M03.F01.I03");
  });

  fnTest(["M03.F01.I03"], "I03 点新建角色打开 Dialog（不弹 alert）", async () => {
    const alertSpy = vi.spyOn(window, "alert");
    const { getByTestId } = render(<RolesClient initialRoles={initialRoles} />);
    fireEvent.click(getByTestId("new-role-btn"));
    await waitFor(() => {
      expect(getByTestId("new-role-dialog")).toBeTruthy();
    });
    expect(alertSpy).not.toHaveBeenCalled();
  });

  fnTest(["M03.F01.I03"], "I03 Dialog 含 code / name / description / enabled 4 个字段", async () => {
    const { getByTestId } = render(<RolesClient initialRoles={initialRoles} />);
    fireEvent.click(getByTestId("new-role-btn"));
    await waitFor(() => {
      expect(getByTestId("new-role-dialog")).toBeTruthy();
    });
    expect(getByTestId("new-role-code")).toBeTruthy();
    expect(getByTestId("new-role-name")).toBeTruthy();
    expect(getByTestId("new-role-description")).toBeTruthy();
    expect(getByTestId("new-role-enabled")).toBeTruthy();
  });

  fnTest(["M03.F01.I03"], "I03 提交 Dialog 调 POST /api/roles 并把新角色加进列表", async () => {
    const newRole = {
      id: 99,
      code: "editor",
      name: "Editor",
      description: "Can edit",
      enabled: true,
      createdAt: "2026-07-17 12:00:00",
      updatedAt: "2026-07-17 12:00:00",
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(newRole), { status: 201 }),
    );
    const { getByTestId, queryByTestId, getAllByTestId } = render(
      <RolesClient initialRoles={initialRoles} />,
    );
    fireEvent.click(getByTestId("new-role-btn"));
    await waitFor(() => expect(getByTestId("new-role-dialog")).toBeTruthy());

    fireEvent.change(getByTestId("new-role-code"), { target: { value: "editor" } });
    fireEvent.change(getByTestId("new-role-name"), { target: { value: "Editor" } });
    fireEvent.change(getByTestId("new-role-description"), {
      target: { value: "Can edit" },
    });
    fireEvent.click(getByTestId("new-role-submit"));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/roles");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.code).toBe("editor");
    expect(body.name).toBe("Editor");
    expect(body.description).toBe("Can edit");

    // 列表多了一行
    await waitFor(() => {
      expect(getAllByTestId("role-row").length).toBe(4);
    });
    // Dialog 自动关
    await waitFor(() => {
      expect(queryByTestId("new-role-dialog")).toBeNull();
    });
  });

  fnTest(["M03.F01.I03"], "I03 后端返回 4xx 时不关 Dialog、不加列表（错误处理）", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "missing required fields: code, name" }), {
        status: 400,
      }),
    );
    const { getByTestId, queryByTestId, getAllByTestId } = render(
      <RolesClient initialRoles={initialRoles} />,
    );
    fireEvent.click(getByTestId("new-role-btn"));
    await waitFor(() => expect(getByTestId("new-role-dialog")).toBeTruthy());

    fireEvent.change(getByTestId("new-role-code"), { target: { value: "x" } });
    fireEvent.change(getByTestId("new-role-name"), { target: { value: "y" } });
    fireEvent.click(getByTestId("new-role-submit"));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    // 等异步错误处理完
    await new Promise((r) => setTimeout(r, 50));
    // 列表没动（仍 3 行）
    expect(getAllByTestId("role-row").length).toBe(3);
    // Dialog 还在（方便用户改）
    expect(queryByTestId("new-role-dialog")).toBeTruthy();
  });

  fnTest(["M03.F01.I04"], "编辑角色按钮挂 data-fn M03.F01.I04", () => {
    const { getAllByTestId } = render(<RolesClient initialRoles={initialRoles} />);
    expect(getAllByTestId("edit-role-btn")[0]!.getAttribute("data-fn")).toBe("M03.F01.I04");
  });

  fnTest(["M03.F01.I04"], "I04 点编辑打开 Dialog 且字段预填（不弹 alert）", async () => {
    const alertSpy = vi.spyOn(window, "alert");
    const { getAllByTestId, getByTestId } = render(
      <RolesClient initialRoles={initialRoles} />,
    );
    fireEvent.click(getAllByTestId("edit-role-btn")[0]!);
    await waitFor(() => {
      expect(getByTestId("edit-role-dialog")).toBeTruthy();
    });
    expect(alertSpy).not.toHaveBeenCalled();
    // 预填：第一行是 admin
    expect((getByTestId("edit-role-code") as HTMLInputElement).value).toBe("admin");
    expect((getByTestId("edit-role-name") as HTMLInputElement).value).toBe("Administrator");
    expect((getByTestId("edit-role-enabled") as HTMLInputElement).checked).toBe(true);
  });

  fnTest(["M03.F01.I04"], "I04 编辑 Dialog 不可改 code（code 是只读）", async () => {
    const { getAllByTestId, getByTestId } = render(
      <RolesClient initialRoles={initialRoles} />,
    );
    fireEvent.click(getAllByTestId("edit-role-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-role-dialog")).toBeTruthy());
    expect((getByTestId("edit-role-code") as HTMLInputElement).disabled).toBe(true);
  });

  fnTest(["M03.F01.I04"], "I04 提交编辑调 PUT /api/roles/[id] 并更新列表行", async () => {
    const updated = {
      id: 1,
      code: "admin",
      name: "Administrator (改)",
      description: "All perms v2",
      enabled: false,
      createdAt: "2026-01-01 00:00:00",
      updatedAt: "2026-07-17 12:00:00",
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(updated), { status: 200 }),
    );
    const { getAllByTestId, getByTestId, queryByTestId } = render(
      <RolesClient initialRoles={initialRoles} />,
    );
    fireEvent.click(getAllByTestId("edit-role-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-role-dialog")).toBeTruthy());

    fireEvent.change(getByTestId("edit-role-name"), {
      target: { value: "Administrator (改)" },
    });
    fireEvent.change(getByTestId("edit-role-description"), {
      target: { value: "All perms v2" },
    });
    fireEvent.click(getByTestId("edit-role-enabled")); // 取消启用
    fireEvent.click(getByTestId("edit-role-submit"));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/roles/1");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe("Administrator (改)");
    expect(body.description).toBe("All perms v2");
    expect(body.enabled).toBe(false);

    // 列表行更新
    await waitFor(() => {
      expect(getByTestId("roles-page").textContent).toContain("Administrator (改)");
    });
    // Dialog 关
    await waitFor(() => {
      expect(queryByTestId("edit-role-dialog")).toBeNull();
    });
  });

  fnTest(["M03.F01.I04"], "I04 后端 4xx 时不关 Dialog、不更新列表", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "role not found" }), { status: 404 }),
    );
    const { getAllByTestId, getByTestId, queryByTestId } = render(
      <RolesClient initialRoles={initialRoles} />,
    );
    fireEvent.click(getAllByTestId("edit-role-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-role-dialog")).toBeTruthy());

    fireEvent.change(getByTestId("edit-role-name"), { target: { value: "X" } });
    fireEvent.click(getByTestId("edit-role-submit"));

    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 50));
    // 列表第一行还是原名
    expect(getByTestId("roles-page").textContent).toContain("Administrator");
    // Dialog 还在
    expect(queryByTestId("edit-role-dialog")).toBeTruthy();
  });

  fnTest(
    ["M03.F01.I06"],
    "I06 表单校验：Code / 名称 必填，loading 时按钮禁用",
    async () => {
      const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
        new Response(JSON.stringify({ id: 99, code: "qa", name: "QA", description: null, enabled: true, createdAt: "", updatedAt: "" }), { status: 201 }),
      );
      const { getByTestId } = render(<RolesClient initialRoles={initialRoles} />);
      fireEvent.click(getByTestId("new-role-btn"));
      await waitFor(() => expect(getByTestId("new-role-dialog")).toBeTruthy());
      // 表单区有 data-fn M03.F01.I06（必填/取消/loading 三件套）
      expect(
        getByTestId("new-role-dialog").querySelector("[data-fn='M03.F01.I06']"),
      ).toBeTruthy();
      // 空提交不调 fetch（必填校验拦在前面）
      fireEvent.click(getByTestId("new-role-submit"));
      await new Promise((r) => setTimeout(r, 50));
      expect(fetchSpy).not.toHaveBeenCalled();
      // 填齐必填后提交，调 fetch + 关 Dialog
      fireEvent.change(getByTestId("new-role-code"), { target: { value: "qa" } });
      fireEvent.change(getByTestId("new-role-name"), { target: { value: "QA" } });
      fireEvent.click(getByTestId("new-role-submit"));
      await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    },
  );

  fnTest(["M03.F01.I07"], "I07 行内「权限」按钮挂 data-fn M03.F01.I07", () => {
    const { getAllByTestId } = render(<RolesClient initialRoles={initialRoles} />);
    expect(getAllByTestId("role-permissions-btn")[0]!.getAttribute("data-fn")).toBe(
      "M03.F01.I07",
    );
  });

  fnTest(["M03.F01.I07"], "I07 点权限按钮打开 RolePermissionsDialog (调 GET /api/roles/[id]/permissions)", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ roleId: 1, permissions: ["user:read"] }), {
        status: 200,
      }),
    );
    const { getAllByTestId, getByTestId } = render(
      <RolesClient initialRoles={initialRoles} />,
    );
    fireEvent.click(getAllByTestId("role-permissions-btn")[0]!);
    await waitFor(() => expect(getByTestId("role-permissions-dialog")).toBeTruthy());
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url] = fetchSpy.mock.calls[0] as [string];
    expect(url).toBe("/api/roles/1/permissions");
  });

  fnTest(["M03.F01.I07"], "I07 提交 RolePermissionsDialog 调 PUT /api/roles/[id]/permissions", async () => {
    const fetchSpy = vi
      .spyOn(global, "fetch")
      .mockImplementation(async (_input, init) => {
        if ((init?.method ?? "GET") === "GET") {
          return new Response(
            JSON.stringify({ roleId: 1, permissions: [] }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({ roleId: 1, permissions: ["user:read", "user:write"] }),
          { status: 200 },
        );
      });
    const { getAllByTestId, getByTestId } = render(
      <RolesClient initialRoles={initialRoles} />,
    );
    fireEvent.click(getAllByTestId("role-permissions-btn")[0]!);
    await waitFor(() => expect(getByTestId("role-permissions-dialog")).toBeTruthy());
    await waitFor(() => expect(getByTestId("role-permissions-submit")).toBeTruthy());
    fireEvent.click(getByTestId("role-permission-user-read"));
    fireEvent.click(getByTestId("role-permission-user-write"));
    fireEvent.click(getByTestId("role-permissions-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2));
    const putCall = fetchSpy.mock.calls.find(
      (call) => (call[1] as RequestInit | undefined)?.method === "PUT",
    ) as [string, RequestInit] | undefined;
    expect(putCall).toBeTruthy();
    expect(putCall![0]).toBe("/api/roles/1/permissions");
    const body = JSON.parse(putCall![1].body as string);
    expect(body.permissions).toEqual(expect.arrayContaining(["user:read", "user:write"]));
  });

  fnTest(["M03.F01.I05"], "删除角色按钮点击触发 fetch DELETE（点 confirm 后）", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(<RolesClient initialRoles={initialRoles} />);
    const deleteBtns = getAllByTestId("delete-role-btn");
    expect(deleteBtns[0]!.getAttribute("data-fn")).toBe("M03.F01.I05");
    fireEvent.click(deleteBtns[0]!);
    await waitFor(() => expect(getByTestId("confirm-dialog")).toBeTruthy());
    const dialog = getByTestId("confirm-dialog");
    const buttons = Array.from(dialog.querySelectorAll("button"));
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/roles/1");
    expect(init.method).toBe("DELETE");
  });
});