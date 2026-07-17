import { SettingsDomainClient, type SettingItem } from "@/components/app/settings-domain-client";

// @entry M06.F04.I01 Token 管理页容器
// @entry M06.F04.I02 访问令牌有效期
// @entry M06.F04.I03 Refresh Token 有效期
// @entry M06.F04.I04 开启 Refresh Token 续期
// @entry M06.F04.I05 开启 Token 主动失效
const ITEMS: SettingItem[] = [
  {
    id: "M06.F04.I01",
    key: "token.access.ttl_seconds",
    title: "访问令牌有效期（秒）",
    type: "number",
    initialValue: "3600",
    description: "默认 1 小时",
  },
  {
    id: "M06.F04.I02",
    key: "token.refresh.ttl_seconds",
    title: "Refresh Token 有效期（秒）",
    type: "number",
    initialValue: "2592000",
    description: "默认 30 天",
  },
  {
    id: "M06.F04.I03",
    key: "token.refresh.renewal",
    title: "开启 Refresh Token 续期",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F04.I04",
    key: "token.revocation.enabled",
    title: "开启 Token 主动失效",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F04.I05",
    key: "token.signing_alg",
    title: "签名算法",
    type: "string",
    initialValue: "HS256",
    description: "HS256 / RS256 / ES256",
  },
];

export default function TokensPage() {
  return (
    <SettingsDomainClient
      pageTestId="tokens-page"
      pageFnId="M06.F04.I01"
      pageTitle="Token 配置"
      prefix="tokens"
      items={ITEMS}
    />
  );
}