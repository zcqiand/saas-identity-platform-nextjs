import { SettingsDomainClient, type SettingItem } from "@/components/app/settings-domain-client";

// @entry M06.F06.I01 风险控制页容器
// @entry M06.F06.I02 异常登录检测
// @entry M06.F06.I03 异地登录告警
// @entry M06.F06.I04 设备指纹识别
// @entry M06.F06.I05 风险评分阈值
const ITEMS: SettingItem[] = [
  {
    id: "M06.F06.I01",
    key: "risk.detect.anomaly_login",
    title: "异常登录检测",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F06.I02",
    key: "risk.detect.remote_alert",
    title: "异地登录告警",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F06.I03",
    key: "risk.detect.device_fingerprint",
    title: "设备指纹识别",
    type: "boolean",
    initialValue: "false",
  },
  {
    id: "M06.F06.I04",
    key: "risk.score.threshold",
    title: "风险评分阈值",
    type: "number",
    initialValue: "70",
    description: "0-100，超过则触发二次校验",
  },
  {
    id: "M06.F06.I05",
    key: "risk.action.auto_lock",
    title: "高风险自动锁定",
    type: "boolean",
    initialValue: "false",
  },
];

export default function RiskPage() {
  return (
    <SettingsDomainClient
      pageTestId="risk-page"
      pageFnId="M06.F06.I01"
      pageTitle="风险控制"
      prefix="risk"
      items={ITEMS}
    />
  );
}