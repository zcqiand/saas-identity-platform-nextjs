import { SettingsDomainClient, type SettingItem } from "@/components/app/settings-domain-client";

// @entry M06.F03.I01 密码策略页容器
// @entry M06.F03.I02 启用密码策略
// @entry M06.F03.I03 最小密码长度
// @entry M06.F03.I04 必须包含大写字母
// @entry M06.F03.I05 必须包含小写字母
// @entry M06.F03.I06 必须包含数字
// @entry M06.F03.I07 必须包含特殊字符
// @entry M06.F03.I08 密码过期天数
// @entry M06.F03.I09 历史密码数量
const ITEMS: SettingItem[] = [
  {
    id: "M06.F03.I01",
    key: "password.policy.enabled",
    title: "启用密码策略",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F03.I02",
    key: "password.policy.min_length",
    title: "最小密码长度",
    type: "number",
    initialValue: "8",
    description: "6-32 之间",
  },
  {
    id: "M06.F03.I03",
    key: "password.policy.require_uppercase",
    title: "必须包含大写字母",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F03.I04",
    key: "password.policy.require_lowercase",
    title: "必须包含小写字母",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F03.I05",
    key: "password.policy.require_digit",
    title: "必须包含数字",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F03.I06",
    key: "password.policy.require_special",
    title: "必须包含特殊字符",
    type: "boolean",
    initialValue: "false",
  },
  {
    id: "M06.F03.I07",
    key: "password.expiry_days",
    title: "密码过期天数",
    type: "number",
    initialValue: "90",
    description: "0 = 永不过期",
  },
  {
    id: "M06.F03.I08",
    key: "password.history_count",
    title: "历史密码数量",
    type: "number",
    initialValue: "5",
    description: "不可重用最近 N 次密码",
  },
  {
    id: "M06.F03.I09",
    key: "password.max_retry",
    title: "最大重试次数",
    type: "number",
    initialValue: "5",
  },
];

export default function PasswordPage() {
  return (
    <SettingsDomainClient
      pageTestId="password-page"
      pageFnId="M06.F03.I01"
      pageTitle="密码策略"
      prefix="password"
      items={ITEMS}
    />
  );
}