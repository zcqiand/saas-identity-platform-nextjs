import { SettingsDomainClient, type SettingItem } from "@/components/app/settings-domain-client";

// @entry M06.F02.I01 登录方式配置页容器
// @entry M06.F02.I02 登录方式启用开关
// @entry M06.F02.I03 SSO 提供商启用开关
// @entry M06.F02.I04 OAuth2 提供商启用开关
const ITEMS: SettingItem[] = [
  {
    id: "M06.F02.I01",
    key: "login.page.title",
    title: "登录页标题",
    type: "string",
    initialValue: "SaaS 统一身份管理 — 登录",
    description: "登录页 H1 大字",
  },
  {
    id: "M06.F02.I02",
    key: "login.method.password.enabled",
    title: "启用账号密码登录",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F02.I03",
    key: "login.method.sso.enabled",
    title: "启用 SSO 登录",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F02.I04",
    key: "login.method.oauth.enabled",
    title: "启用 OAuth2 登录",
    type: "boolean",
    initialValue: "false",
  },
];

export default function LoginMethodsPage() {
  return (
    <SettingsDomainClient
      pageTestId="login-methods-page"
      pageFnId="M06.F02.I01"
      pageTitle="登录方式配置"
      prefix="login-methods"
      items={ITEMS}
    />
  );
}