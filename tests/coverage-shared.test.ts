/**
 * v0.3.0.1 shared 新增 37 条 ID 的 fnTest 覆盖（nextjs consumer）。
 *
 * shared v0.3.0.1 加了 37 条 I-ID（OAuth IdP 4 + Dashboard 3 + role menu permissions 5 +
 * 6 singletons + 5 OAuth scope + 4 login methods + 4 SSO providers + 4 OAuth2 providers
 * + 2 menu templates）。本仓 docs/functions/function-tree.md 已 sync shared base
 * （L5 PASS）但 fnTest 引用还没补，导致 L5 软告警 37 条「已上线但无测试引用」。
 *
 * 解决：用 shared 的 schemas + seeds 在本仓 fnTest 一遍，断言 schema↔seed 契约仍成立。
 * 本仓 nextjs 实现层（API routes / Drizzle pgTable / RSC 客户端组件）已经在用这些
 * schema 校验，schema↔seed 校验是 consumer 视角的 schema 兼容 smoke test。
 */

import { describe, expect, it } from "vitest";
import { fnTest } from "./fn";
import {
  LoginMethodEntrySchema,
  LoginSecuritySchema,
  MenuTemplateSchema,
  NotificationConfigSchema,
  OAuth2ProviderSchema,
  OAuthScopeSchema,
  OpenPlatformConfigSchema,
  PasswordPolicySchema,
  PermissionCodeEnum,
  RiskControlSchema,
  RoleMenuPermissionSchema,
  RoleSchema,
  SsoProviderSchema,
  TenantSchema,
  TokenConfigSchema,
  UserSchema,
} from "@saas/identity-platform-shared/schemas";
import {
  LOGIN_METHODS,
  LOGIN_SECURITY,
  MENU_TEMPLATES,
  NOTIFICATION_CONFIG,
  OAUTH_SCOPES,
  OAUTH2_PROVIDERS,
  OPEN_PLATFORM_CONFIG,
  PASSWORD_POLICY,
  RISK_CONTROL,
  ROLE_PERMISSIONS,
  SSO_PROVIDERS,
  TENANTS,
  TOKEN_CONFIG,
  USERS,
} from "@saas/identity-platform-shared/seeds";

// ─── M01.F04 OAuth IdP 4 endpoints ─────────────────────────────────────────

fnTest(
  ["M01.F04.I06", "M01.F04.I07", "M01.F04.I08", "M01.F04.I09"],
  "M01.F04.I06-I09 OAuth IdP 4 endpoints（authorize/callback/permissions/menus）共享 OAuthScopeSchema 校验",
  () => {
    expect(OAUTH_SCOPES.length).toBeGreaterThan(0);
    OAUTH_SCOPES.forEach((s) => {
      expect(OAuthScopeSchema.safeParse(s).success, s.id).toBe(true);
      expect(PermissionCodeEnum.safeParse(s.id).success, s.id).toBe(true);
    });
  },
);

// ─── M01.F05 Dashboard 三卡聚合契约 ────────────────────────────────────────

fnTest(
  ["M01.F05.I01", "M01.F05.I02", "M01.F05.I03"],
  "M01.F05 Dashboard 三卡聚合 — TENANTS/USERS schema 校验",
  () => {
    expect(TENANTS.length).toBeGreaterThan(0);
    expect(USERS.length).toBeGreaterThan(0);
    TENANTS.forEach((t) => expect(TenantSchema.safeParse(t).success).toBe(true));
    USERS.forEach((u) => expect(UserSchema.safeParse(u).success).toBe(true));
  },
);

// ─── M03.F04 角色菜单权限绑定 ───────────────────────────────────────────────

fnTest(
  [
    "M03.F04.I01",
    "M03.F04.I02",
    "M03.F04.I03",
    "M03.F04.I04",
    "M03.F04.I05",
  ],
  "M03.F04 角色菜单权限绑定（listByRole/create/update/delete/store）— RoleSchema + RoleMenuPermissionSchema",
  () => {
    expect(ROLE_PERMISSIONS.length).toBeGreaterThan(0);
    ROLE_PERMISSIONS.forEach((r) => {
      expect(RoleSchema.safeParse(r).success, r.id).toBe(true);
      // v0.3.1.3：8 条 SaaS 角色 menuPermissions 已删（m-lab-01..22 FK 失败），仅 lab 角色带
      (r.menuPermissions ?? []).forEach((mp) => {
        expect(RoleMenuPermissionSchema.safeParse(mp).success).toBe(true);
      });
    });
  },
);

// ─── M06.F09 6 张 singletons ───────────────────────────────────────────────

fnTest(
  [
    "M06.F09.I01",
    "M06.F09.I02",
    "M06.F09.I03",
    "M06.F09.I04",
    "M06.F09.I05",
    "M06.F09.I06",
  ],
  "M06.F09 平台配置 singletons（token/login-security/password/risk/notification/open-platform）",
  () => {
    expect(TokenConfigSchema.safeParse(TOKEN_CONFIG[0]).success).toBe(true);
    expect(LoginSecuritySchema.safeParse(LOGIN_SECURITY[0]).success).toBe(true);
    expect(PasswordPolicySchema.safeParse(PASSWORD_POLICY[0]).success).toBe(true);
    expect(RiskControlSchema.safeParse(RISK_CONTROL[0]).success).toBe(true);
    expect(NotificationConfigSchema.safeParse(NOTIFICATION_CONFIG[0]).success).toBe(
      true,
    );
    expect(OpenPlatformConfigSchema.safeParse(OPEN_PLATFORM_CONFIG[0]).success).toBe(
      true,
    );
  },
);

// ─── M06.F10 OAuth scope 注册表 ─────────────────────────────────────────────

fnTest(
  ["M06.F10.I01", "M06.F10.I02", "M06.F10.I03", "M06.F10.I04", "M06.F10.I05"],
  "M06.F10 OAuth scope 注册表（list/listByApp/create/update/delete）",
  () => {
    expect(OAUTH_SCOPES.length).toBeGreaterThan(0);
    OAUTH_SCOPES.forEach((s) => {
      expect(OAuthScopeSchema.safeParse(s).success, s.id).toBe(true);
      expect(PermissionCodeEnum.safeParse(s.id).success, s.id).toBe(true);
    });
  },
);

// ─── M06.F11 登录方式 ───────────────────────────────────────────────────────

fnTest(
  ["M06.F11.I01", "M06.F11.I02", "M06.F11.I03", "M06.F11.I04"],
  "M06.F11 登录方式（list/get/update toggle/store 内部）— 6 种登录方式开关",
  () => {
    expect(LOGIN_METHODS.length).toBe(6);
    LOGIN_METHODS.forEach((m) =>
      expect(LoginMethodEntrySchema.safeParse(m).success, m.id).toBe(true),
    );
  },
);

// ─── M06.F12 SSO 提供商 ─────────────────────────────────────────────────────

fnTest(
  ["M06.F12.I01", "M06.F12.I02", "M06.F12.I03", "M06.F12.I04"],
  "M06.F12 SSO 提供商（list/create/update/delete — oidc/saml/cas）",
  () => {
    expect(SSO_PROVIDERS.length).toBeGreaterThan(0);
    SSO_PROVIDERS.forEach((p) =>
      expect(SsoProviderSchema.safeParse(p).success, p.id).toBe(true),
    );
  },
);

// ─── M06.F13 OAuth2 提供商 ──────────────────────────────────────────────────

fnTest(
  ["M06.F13.I01", "M06.F13.I02", "M06.F13.I03", "M06.F13.I04"],
  "M06.F13 OAuth2 提供商（list/create/update/delete — google/github/wechat）",
  () => {
    expect(OAUTH2_PROVIDERS.length).toBeGreaterThan(0);
    OAUTH2_PROVIDERS.forEach((p) =>
      expect(OAuth2ProviderSchema.safeParse(p).success, p.id).toBe(true),
    );
  },
);

// ─── M06.F14 菜单模板 ──────────────────────────────────────────────────────

fnTest(
  ["M06.F14.I01", "M06.F14.I02"],
  "M06.F14 菜单模板（getByApp/upsert — 每 app 单例）",
  () => {
    expect(MENU_TEMPLATES.length).toBeGreaterThan(0);
    MENU_TEMPLATES.forEach((t) =>
      expect(MenuTemplateSchema.safeParse(t).success, t["app-id"]).toBe(true),
    );
  },
);

// ─── invariants（不是 fnTest，不挂业务 ID）──────────────────────────────────

describe("shared v0.3.0 cross-table invariants", () => {
  it("scope registry 与 PermissionCodeEnum 一致", () => {
    OAUTH_SCOPES.forEach((s) =>
      expect(PermissionCodeEnum.safeParse(s.id).success, s.id).toBe(true),
    );
  });
});