// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { PositionsClient } from "@/app/(protected)/positions/positions-client";
import { fnTest } from "../fn";

/**
 * M02.F03 岗位管理（fn-ID M02.F03.I01-I05）
 *
 * 覆盖：I01 页面 / I02 查询 mount / I03 新建 / I04 编辑 / I05 删除
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const initialPositions = [
  { id: 1, code: "ceo", name: "CEO", description: null, sort: 1, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00", members: [] },
  { id: 2, code: "eng", name: "Engineer", description: null, sort: 10, enabled: true, createdAt: "2026-01-01 00:00:00", updatedAt: "2026-01-01 00:00:00", members: [] },
];

describe("M02.F03 positions list page", () => {
  fnTest(["M02.F03.I01"], "页面根挂 data-fn M02.F03.I01", () => {
    const { getByTestId } = render(<PositionsClient initialPositions={initialPositions} />);
    expect(getByTestId("positions-page").getAttribute("data-fn")).toBe("M02.F03.I01");
  });

  fnTest(["M02.F03.I02"], "渲染 2 行 + 列表 mount 自动查询", () => {
    const { getAllByTestId } = render(<PositionsClient initialPositions={initialPositions} />);
    expect(getAllByTestId("position-row").length).toBe(2);
  });

  fnTest(["M02.F03.I03"], "新建岗位按钮挂 data-fn M02.F03.I03", () => {
    const { getByTestId } = render(<PositionsClient initialPositions={initialPositions} />);
    expect(getByTestId("new-position-btn").getAttribute("data-fn")).toBe("M02.F03.I03");
  });

  fnTest(["M02.F03.I03"], "I03 点新建打开 Dialog（不弹 alert）", async () => {
    const alertSpy = vi.spyOn(window, "alert");
    const { getByTestId } = render(<PositionsClient initialPositions={initialPositions} />);
    fireEvent.click(getByTestId("new-position-btn"));
    await waitFor(() => expect(getByTestId("new-position-dialog")).toBeTruthy());
    expect(alertSpy).not.toHaveBeenCalled();
  });

  fnTest(["M02.F03.I03"], "I03 提交 Dialog 调 POST /api/positions 并把新岗位加进列表", async () => {
    const created = {
      id: 99,
      code: "qa",
      name: "QA",
      description: null,
      sort: 0,
      enabled: true,
      createdAt: "2026-07-17 12:00:00",
      updatedAt: "2026-07-17 12:00:00",
      members: [],
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(created), { status: 201 }),
    );
    const { getByTestId, getAllByTestId } = render(
      <PositionsClient initialPositions={initialPositions} />,
    );
    fireEvent.click(getByTestId("new-position-btn"));
    await waitFor(() => expect(getByTestId("new-position-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("new-position-code"), { target: { value: "qa" } });
    fireEvent.change(getByTestId("new-position-name"), { target: { value: "QA" } });
    fireEvent.click(getByTestId("new-position-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/positions");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ code: "qa", name: "QA" });
    await waitFor(() => expect(getAllByTestId("position-row").length).toBe(3));
  });

  fnTest(["M02.F03.I04"], "编辑岗位按钮挂 data-fn M02.F03.I04", () => {
    const { getAllByTestId } = render(<PositionsClient initialPositions={initialPositions} />);
    expect(getAllByTestId("edit-position-btn")[0]!.getAttribute("data-fn")).toBe("M02.F03.I04");
  });

  fnTest(["M02.F03.I04"], "I04 编辑按钮打开 EditPositionDialog", async () => {
    const { getAllByTestId, getByTestId } = render(
      <PositionsClient initialPositions={initialPositions} />,
    );
    fireEvent.click(getAllByTestId("edit-position-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-position-dialog")).toBeTruthy());
  });

  fnTest(["M02.F03.I04"], "I04 提交 EditPositionDialog 调 PUT /api/positions/[id]", async () => {
    const updated = {
      id: 1,
      code: "ceo",
      name: "CEO Renamed",
      description: null,
      sort: 1,
      enabled: true,
      createdAt: "2026-01-01 00:00:00",
      updatedAt: "2026-07-17 12:00:00",
      members: [],
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(updated), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(
      <PositionsClient initialPositions={initialPositions} />,
    );
    fireEvent.click(getAllByTestId("edit-position-btn")[0]!);
    await waitFor(() => expect(getByTestId("edit-position-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("edit-position-name"), { target: { value: "CEO Renamed" } });
    fireEvent.click(getByTestId("edit-position-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/positions/1");
    expect(init.method).toBe("PUT");
  });

  fnTest(["M02.F03.I05"], "删除岗位按钮点击触发 fetch DELETE（点 confirm 后）", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(
      <PositionsClient initialPositions={initialPositions} />,
    );
    const deleteBtns = getAllByTestId("delete-position-btn");
    expect(deleteBtns[0]!.getAttribute("data-fn")).toBe("M02.F03.I05");
    fireEvent.click(deleteBtns[0]!);
    await waitFor(() => expect(getByTestId("confirm-dialog")).toBeTruthy());
    const dialog = getByTestId("confirm-dialog");
    const buttons = Array.from(dialog.querySelectorAll("button"));
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/positions/1");
    expect(init.method).toBe("DELETE");
  });
});