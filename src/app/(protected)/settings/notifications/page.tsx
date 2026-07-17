import { SettingsDomainClient, type SettingItem } from "@/components/app/settings-domain-client";

// @entry M06.F05.I01 消息通知页容器
// @entry M06.F05.I02 邮件通知
// @entry M06.F05.I03 短信通知
// @entry M06.F05.I04 站内信
// @entry M06.F05.I05 登录通知
// @entry M06.F05.I06 密码变更
// @entry M06.F05.I07 安全告警
// @entry M06.F05.I08 系统通知
const ITEMS: SettingItem[] = [
  {
    id: "M06.F05.I01",
    key: "notify.email.enabled",
    title: "启用邮件通知",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F05.I02",
    key: "notify.sms.enabled",
    title: "启用短信通知",
    type: "boolean",
    initialValue: "false",
  },
  {
    id: "M06.F05.I03",
    key: "notify.in_app.enabled",
    title: "启用站内信",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F05.I04",
    key: "notify.event.login",
    title: "登录通知",
    type: "boolean",
    initialValue: "false",
    description: "用户登录时通知",
  },
  {
    id: "M06.F05.I05",
    key: "notify.event.password_change",
    title: "密码变更通知",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F05.I06",
    key: "notify.event.security_alert",
    title: "安全告警",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F05.I07",
    key: "notify.event.system",
    title: "系统通知",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F05.I08",
    key: "notify.digest",
    title: "日终通知摘要",
    type: "boolean",
    initialValue: "false",
  },
];

export default function NotificationsPage() {
  return (
    <SettingsDomainClient
      pageTestId="notifications-page"
      pageFnId="M06.F05.I01"
      pageTitle="消息通知"
      prefix="notifications"
      items={ITEMS}
    />
  );
}