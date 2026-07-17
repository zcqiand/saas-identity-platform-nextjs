import { SettingsDomainClient, type SettingItem } from "@/components/app/settings-domain-client";

// @entry M06.F07.I01 开放平台页容器
// @entry M06.F07.I02 OpenAPI 开关
// @entry M06.F07.I03 Webhook 开关
// @entry M06.F07.I04 SDK 下载开关
// @entry M06.F07.I05 允许调用的 Scope
// @entry M06.F07.I06 回调地址白名单
const ITEMS: SettingItem[] = [
  {
    id: "M06.F07.I01",
    key: "openapi.enabled",
    title: "启用 OpenAPI",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F07.I02",
    key: "openapi.webhook.enabled",
    title: "启用 Webhook",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F07.I03",
    key: "openapi.sdk.enabled",
    title: "启用 SDK 下载",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F07.I04",
    key: "openapi.scope.user.read",
    title: "Scope：user.read",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F07.I05",
    key: "openapi.scope.user.write",
    title: "Scope：user.write",
    type: "boolean",
    initialValue: "false",
  },
  {
    id: "M06.F07.I06",
    key: "openapi.callback.allowlist",
    title: "回调地址白名单（逗号分隔）",
    type: "string",
    initialValue: "",
    description: "空 = 不限制",
  },
];

export default function OpenapiPage() {
  return (
    <SettingsDomainClient
      pageTestId="openapi-page"
      pageFnId="M06.F07.I01"
      pageTitle="开放平台"
      prefix="openapi"
      items={ITEMS}
    />
  );
}