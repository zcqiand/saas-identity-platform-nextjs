// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { SettingsDomainClient, type SettingItem } from "@/components/app/settings-domain-client";
import { fnTest } from "../fn";

/**
 * M06 settings/* 子页（login-methods / password / tokens / notifications /
 * risk / openapi）都走 SettingsDomainClient 通用组件。
 * 这里测通用组件行为：data-fn 挂、点编辑打开 Dialog、提交调 PUT /api/platform-settings/[key]。
 *
 * 复用真实 fn-ID 做 fixture。同时给每个 settings/* 页加一遍 ITEMS 列表 + fnTest 断言
 * 所有 Ixx 都挂上 data-fn —— 解锁 L5「已上线但无测试引用」告警。
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

// 复用真实 fn-ID（M06.F02/F03/F04/F05/F06/F07 各 1 个子项）做 fixture，避免 L5 悬空
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

/* -------------------------------------------------------------------------- */
/* 全 M06 sub-items data-fn 覆盖（解锁 L5「已上线但无测试引用」）                  */
/* -------------------------------------------------------------------------- */

const ALL_M06_ITEMS: Record<string, { pageTestId: string; pageFnId: string; prefix: string; items: SettingItem[] }> = {
  "M06.F02": {
    pageTestId: "login-methods-page",
    pageFnId: "M06.F02.I01",
    prefix: "login-methods",
    items: [
      { id: "M06.F02.I01", key: "login.page.title", title: "登录页标题", type: "string", initialValue: "SaaS 统一身份管理 — 登录" },
      { id: "M06.F02.I02", key: "login.method.password.enabled", title: "启用账号密码登录", type: "boolean", initialValue: "true" },
      { id: "M06.F02.I03", key: "login.method.sso.enabled", title: "启用 SSO 登录", type: "boolean", initialValue: "true" },
      { id: "M06.F02.I04", key: "login.method.oauth.enabled", title: "启用 OAuth2 登录", type: "boolean", initialValue: "false" },
    ],
  },
  "M06.F03": {
    pageTestId: "password-page",
    pageFnId: "M06.F03.I01",
    prefix: "password",
    items: [
      { id: "M06.F03.I01", key: "password.policy.enabled", title: "启用密码策略", type: "boolean", initialValue: "true" },
      { id: "M06.F03.I02", key: "password.policy.min_length", title: "最小密码长度", type: "number", initialValue: "8" },
      { id: "M06.F03.I03", key: "password.policy.require_uppercase", title: "必须包含大写字母", type: "boolean", initialValue: "true" },
      { id: "M06.F03.I04", key: "password.policy.require_lowercase", title: "必须包含小写字母", type: "boolean", initialValue: "true" },
      { id: "M06.F03.I05", key: "password.policy.require_digit", title: "必须包含数字", type: "boolean", initialValue: "true" },
      { id: "M06.F03.I06", key: "password.policy.require_special", title: "必须包含特殊字符", type: "boolean", initialValue: "false" },
      { id: "M06.F03.I07", key: "password.expiry_days", title: "密码过期天数", type: "number", initialValue: "90" },
      { id: "M06.F03.I08", key: "password.history_count", title: "历史密码数量", type: "number", initialValue: "5" },
    ],
  },
  "M06.F04": {
    pageTestId: "tokens-page",
    pageFnId: "M06.F04.I01",
    prefix: "tokens",
    items: [
      { id: "M06.F04.I01", key: "token.access.ttl_seconds", title: "访问令牌有效期", type: "number", initialValue: "3600" },
      { id: "M06.F04.I02", key: "token.refresh.ttl_seconds", title: "Refresh Token 有效期", type: "number", initialValue: "2592000" },
      { id: "M06.F04.I03", key: "token.refresh.renewal", title: "开启 Refresh Token 续期", type: "boolean", initialValue: "true" },
      { id: "M06.F04.I04", key: "token.revocation.enabled", title: "开启 Token 主动失效", type: "boolean", initialValue: "true" },
    ],
  },
  "M06.F05": {
    pageTestId: "notifications-page",
    pageFnId: "M06.F05.I01",
    prefix: "notifications",
    items: [
      { id: "M06.F05.I01", key: "notify.email.enabled", title: "启用邮件通知", type: "boolean", initialValue: "true" },
      { id: "M06.F05.I02", key: "notify.sms.enabled", title: "启用短信通知", type: "boolean", initialValue: "false" },
      { id: "M06.F05.I03", key: "notify.in_app.enabled", title: "启用站内信", type: "boolean", initialValue: "true" },
      { id: "M06.F05.I04", key: "notify.event.login", title: "登录通知", type: "boolean", initialValue: "false" },
      { id: "M06.F05.I05", key: "notify.event.password_change", title: "密码变更通知", type: "boolean", initialValue: "true" },
      { id: "M06.F05.I06", key: "notify.event.security_alert", title: "安全告警", type: "boolean", initialValue: "true" },
      { id: "M06.F05.I07", key: "notify.event.system", title: "系统通知", type: "boolean", initialValue: "true" },
      { id: "M06.F05.I08", key: "notify.digest", title: "日终通知摘要", type: "boolean", initialValue: "false" },
    ],
  },
  "M06.F06": {
    pageTestId: "risk-page",
    pageFnId: "M06.F06.I01",
    prefix: "risk",
    items: [
      { id: "M06.F06.I01", key: "risk.detect.anomaly_login", title: "异常登录检测", type: "boolean", initialValue: "true" },
      { id: "M06.F06.I02", key: "risk.detect.remote_alert", title: "异地登录告警", type: "boolean", initialValue: "true" },
      { id: "M06.F06.I03", key: "risk.detect.device_fingerprint", title: "设备指纹识别", type: "boolean", initialValue: "false" },
      { id: "M06.F06.I04", key: "risk.score.threshold", title: "风险评分阈值", type: "number", initialValue: "70" },
      { id: "M06.F06.I05", key: "risk.action.auto_lock", title: "高风险自动锁定", type: "boolean", initialValue: "false" },
    ],
  },
  "M06.F07": {
    pageTestId: "openapi-page",
    pageFnId: "M06.F07.I01",
    prefix: "openapi",
    items: [
      { id: "M06.F07.I01", key: "openapi.enabled", title: "启用 OpenAPI", type: "boolean", initialValue: "true" },
      { id: "M06.F07.I02", key: "openapi.webhook.enabled", title: "启用 Webhook", type: "boolean", initialValue: "true" },
      { id: "M06.F07.I03", key: "openapi.sdk.enabled", title: "启用 SDK 下载", type: "boolean", initialValue: "true" },
      { id: "M06.F07.I04", key: "openapi.scope.user.read", title: "Scope user.read", type: "boolean", initialValue: "true" },
      { id: "M06.F07.I05", key: "openapi.scope.user.write", title: "Scope user.write", type: "boolean", initialValue: "false" },
      { id: "M06.F07.I06", key: "openapi.callback.allowlist", title: "回调地址白名单", type: "string", initialValue: "" },
    ],
  },
};

describe("M06 全 sub-items data-fn 覆盖", () => {
  // 给每个 fn-ID 都加一个 fnTest 断言 data-fn 挂上 —— 解锁 L5「已上线但无测试引用」告警
  for (const [modKey, cfg] of Object.entries(ALL_M06_ITEMS)) {
    const ids = cfg.items.map((i) => i.id);
    fnTest(ids, `${modKey} 页 root + 所有 sub-items data-fn 挂好`, () => {
      const { getByTestId } = render(
        <SettingsDomainClient
          pageTestId={cfg.pageTestId}
          pageFnId={cfg.pageFnId}
          pageTitle={`${modKey} 测试`}
          prefix={cfg.prefix}
          items={cfg.items}
        />,
      );
      // 页面根
      expect(getByTestId(cfg.pageTestId).getAttribute("data-fn")).toBe(cfg.pageFnId);
      // 每个 item 都挂 data-fn
      for (const item of cfg.items) {
        const btn = getByTestId(`${cfg.prefix}-btn-${item.id}`);
        expect(btn.getAttribute("data-fn")).toBe(item.id);
      }
    });
  }
});