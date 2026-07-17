// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { ApiKeysClient } from "@/app/(protected)/api-keys/api-keys-client";
import { fnTest } from "../fn";

/**
 * M04.F02 API Key 管理（fn-ID M04.F02.I01-I04）
 *
 * 覆盖：I01 页面根 / I02 新建 / I03 启用禁用 / I04 删除
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const initialKeys = [
  { id: 1, name: "ci-deploy", key: "abcdef1234567890abcdef1234567890", appId: 1, enabled: true, expiresAt: "never", createdAt: "2026-01-01 00:00:00" },
  { id: 2, name: "metric-bot", key: "00000000000000000000000000000000", appId: 2, enabled: true, expiresAt: "never", createdAt: "2026-01-01 00:00:00" },
];

const apps = [
  { id: 1, code: "dashboard", name: "数据看板" },
  { id: 2, code: "billing", name: "计费系统" },
];

describe("M04.F02 api keys page", () => {
  fnTest(["M04.F02.I01"], "页面根挂 data-fn M04.F02.I01", () => {
    const { getByTestId } = render(
      <ApiKeysClient initialKeys={initialKeys} apps={apps} />,
    );
    expect(getByTestId("api-keys-page").getAttribute("data-fn")).toBe("M04.F02.I01");
  });

  fnTest(["M04.F02.I02"], "I02 新建按钮挂 data-fn M04.F02.I02", () => {
    const { getByTestId } = render(
      <ApiKeysClient initialKeys={initialKeys} apps={apps} />,
    );
    expect(getByTestId("new-api-key-btn").getAttribute("data-fn")).toBe("M04.F02.I02");
  });

  fnTest(["M04.F02.I02"], "I02 点新建打开 Dialog", async () => {
    const { getByTestId } = render(
      <ApiKeysClient initialKeys={initialKeys} apps={apps} />,
    );
    fireEvent.click(getByTestId("new-api-key-btn"));
    await waitFor(() => expect(getByTestId("new-api-key-dialog")).toBeTruthy());
  });

  fnTest(["M04.F02.I02"], "I02 提交 Dialog 调 POST /api/api-keys 并把新 Key 加进列表", async () => {
    const created = {
      id: 99,
      name: "alerting",
      key: "ffffffffffffffffffffffffffffffff",
      appId: 1,
      enabled: true,
      expiresAt: "never",
      createdAt: "2026-07-18 12:00:00",
    };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(created), { status: 201 }),
    );
    const { getByTestId, getAllByTestId } = render(
      <ApiKeysClient initialKeys={initialKeys} apps={apps} />,
    );
    fireEvent.click(getByTestId("new-api-key-btn"));
    await waitFor(() => expect(getByTestId("new-api-key-dialog")).toBeTruthy());
    fireEvent.change(getByTestId("new-api-key-name"), { target: { value: "alerting" } });
    fireEvent.click(getByTestId("new-api-key-submit"));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/api-keys");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ name: "alerting", appId: 1 });
    await waitFor(() => expect(getAllByTestId("api-key-row").length).toBe(3));
  });

  fnTest(["M04.F02.I03"], "I03 启用/禁用按钮调 PATCH /api/api-keys/[id]", async () => {
    const toggled = { ...initialKeys[0]!, enabled: false };
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify(toggled), { status: 200 }),
    );
    const { getAllByTestId } = render(
      <ApiKeysClient initialKeys={initialKeys} apps={apps} />,
    );
    const toggleBtn = getAllByTestId("toggle-api-key-btn")[0]!;
    expect(toggleBtn.getAttribute("data-fn")).toBe("M04.F02.I03");
    fireEvent.click(toggleBtn);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/api-keys/1");
    expect(init.method).toBe("PATCH");
  });

  fnTest(["M04.F02.I04"], "I04 删除按钮点击触发 fetch DELETE（点 confirm 后）", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ deleted: true }), { status: 200 }),
    );
    const { getAllByTestId, getByTestId } = render(
      <ApiKeysClient initialKeys={initialKeys} apps={apps} />,
    );
    const deleteBtns = getAllByTestId("delete-api-key-btn");
    expect(deleteBtns[0]!.getAttribute("data-fn")).toBe("M04.F02.I04");
    fireEvent.click(deleteBtns[0]!);
    await waitFor(() => expect(getByTestId("confirm-dialog")).toBeTruthy());
    const dialog = getByTestId("confirm-dialog");
    const buttons = Array.from(dialog.querySelectorAll("button"));
    fireEvent.click(buttons[buttons.length - 1] as HTMLElement);
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/api-keys/1");
    expect(init.method).toBe("DELETE");
  });
});