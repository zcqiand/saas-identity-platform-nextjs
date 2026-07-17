// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { SettingsDomainClient } from "@/components/app/settings-domain-client";
import { fnTest } from "../fn";

/**
 * M06 settings/* 子页（login-methods / password / tokens / notifications /
 * risk / openapi）都走 SettingsDomainClient 通用组件。
 * 这里测通用组件行为：data-fn 挂、点编辑打开 Dialog、提交调 PUT /api/platform-settings/[key]。
 *
 * 复用真实 fn-ID（M06.F02/F03/F04/F05/F06/F07 各 1 个子项）做 fixture。
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

// 用真实 fn-ID 做 fixture，避免 L5 悬空
const BOOLEAN_ITEMS = [
  { id: "M06.F02.I02", key: "login.method.password.enabled", title: "启用账号密码登录", type: "boolean" as const, initialValue: "true" },
];

const NUMBER_ITEMS = [
  { id: "M06.F03.I02", key: "password.policy.min_length", title: "最小密码长度", type: "number" as const, initialValue: "8" },
];

const STRING_ITEMS = [
  { id: "M06.F04.I05", key: "token.signing_alg", title: "签名算法", type: "string" as const, initialValue: "HS256" },
];

describe("M06 settings domain client", () => {
  fnTest(["M06.F02.I02"], "页面根 + 每 item data-fn 挂好", () => {
    const { getByTestId } = render(
      <SettingsDomainClient
        pageTestId="t-page"
        pageFnId="M06.F02.I01"
        pageTitle="测试"
        prefix="t"
        items={BOOLEAN_ITEMS}
      />,
    );
    expect(getByTestId("t-page").getAttribute("data-fn")).toBe("M06.F02.I01");
    expect(getByTestId("t-btn-M06.F02.I02").getAttribute("data-fn")).toBe(
      "M06.F02.I02",
    );
  });

  fnTest(["M06.F02.I02"], "点编辑打开 Dialog（带 key/value 字段）", async () => {
    const { getByTestId } = render(
      <SettingsDomainClient
        pageTestId="t-page"
        pageFnId="M06.F02.I01"
        pageTitle="测试"
        prefix="t"
        items={BOOLEAN_ITEMS}
      />,
    );
    fireEvent.click(getByTestId("t-btn-M06.F02.I02"));
    await waitFor(() =>
      expect(
        getByTestId(
          "settings-edit-dialog-login-method-password-enabled",
        ),
      ).toBeTruthy(),
    );
  });

  fnTest(["M06.F02.I02"], "boolean Dialog 提交调 PUT /api/platform-settings/[key]", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          key: "login.method.password.enabled",
          value: "false",
          description: null,
          updatedAt: "2026-07-18 12:00:00",
        }),
        { status: 200 },
      ),
    );
    const { getByTestId, queryByTestId } = render(
      <SettingsDomainClient
        pageTestId="t-page"
        pageFnId="M06.F02.I01"
        pageTitle="测试"
        prefix="t"
        items={BOOLEAN_ITEMS}
      />,
    );
    fireEvent.click(getByTestId("t-btn-M06.F02.I02"));
    await waitFor(() =>
      expect(
        getByTestId("settings-edit-dialog-login-method-password-enabled"),
      ).toBeTruthy(),
    );
    fireEvent.click(
      getByTestId(
        "settings-edit-dialog-login-method-password-enabled-submit",
      ),
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/platform-settings/login.method.password.enabled");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toMatchObject({ value: "true" });
    await waitFor(() =>
      expect(
        queryByTestId("settings-edit-dialog-login-method-password-enabled"),
      ).toBeNull(),
    );
  });

  fnTest(["M06.F02.I02"], "boolean Dialog 提交调 PUT /api/platform-settings/[key]", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 1,
          key: "login.method.password.enabled",
          value: "false",
          description: null,
          updatedAt: "2026-07-18 12:00:00",
        }),
        { status: 200 },
      ),
    );
    const { getByTestId, queryByTestId } = render(
      <SettingsDomainClient
        pageTestId="t-page"
        pageFnId="M06.F02.I01"
        pageTitle="测试"
        prefix="t"
        items={BOOLEAN_ITEMS}
      />,
    );
    fireEvent.click(getByTestId("t-btn-M06.F02.I02"));
    await waitFor(() =>
      expect(
        getByTestId("settings-edit-dialog-login-method-password-enabled"),
      ).toBeTruthy(),
    );
    // 提交（value="true" 初始，提交后会以 "true" 提交）
    fireEvent.click(
      getByTestId(
        "settings-edit-dialog-login-method-password-enabled-submit",
      ),
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/platform-settings/login.method.password.enabled");
    expect(init.method).toBe("PUT");
    expect(JSON.parse(init.body as string)).toMatchObject({ value: "true" });
    await waitFor(() =>
      expect(
        queryByTestId("settings-edit-dialog-login-method-password-enabled"),
      ).toBeNull(),
    );
  });

  fnTest(["M06.F03.I02"], "number Dialog 提交 value=数字字符串", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ id: 1, key: "password.policy.min_length", value: "12", description: null, updatedAt: "" }),
        { status: 200 },
      ),
    );
    const { getByTestId } = render(
      <SettingsDomainClient
        pageTestId="t-page"
        pageFnId="M06.F03.I01"
        pageTitle="测试"
        prefix="t"
        items={NUMBER_ITEMS}
      />,
    );
    fireEvent.click(getByTestId("t-btn-M06.F03.I02"));
    await waitFor(() =>
      expect(
        getByTestId("settings-edit-dialog-password-policy-min-length"),
      ).toBeTruthy(),
    );
    fireEvent.change(
      getByTestId("settings-edit-dialog-password-policy-min-length-value"),
      { target: { value: "12" } },
    );
    fireEvent.click(
      getByTestId("settings-edit-dialog-password-policy-min-length-submit"),
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/platform-settings/password.policy.min_length");
    expect(JSON.parse(init.body as string)).toMatchObject({ value: "12" });
  });

  fnTest(["M06.F04.I05"], "string Dialog 提交 value=原始字符串", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ id: 1, key: "token.signing_alg", value: "RS256", description: null, updatedAt: "" }),
        { status: 200 },
      ),
    );
    const { getByTestId } = render(
      <SettingsDomainClient
        pageTestId="t-page"
        pageFnId="M06.F04.I01"
        pageTitle="测试"
        prefix="t"
        items={STRING_ITEMS}
      />,
    );
    fireEvent.click(getByTestId("t-btn-M06.F04.I05"));
    await waitFor(() =>
      expect(
        getByTestId("settings-edit-dialog-token-signing-alg"),
      ).toBeTruthy(),
    );
    fireEvent.change(
      getByTestId("settings-edit-dialog-token-signing-alg-value"),
      { target: { value: "RS256" } },
    );
    fireEvent.click(
      getByTestId("settings-edit-dialog-token-signing-alg-submit"),
    );
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toMatchObject({ value: "RS256" });
  });
});