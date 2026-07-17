"use client";

import { SettingsDomainClient, type SettingItem } from "@/components/app/settings-domain-client";

// @entry M06.F01.I01 登录安全策略页容器
// @entry M06.F01.I02 IP 白名单
// @entry M06.F01.I03 IP 黑名单
// @entry M06.F01.I04 启用登录失败锁定
// @entry M06.F01.I05 锁定阈值
// @entry M06.F01.I06 锁定时长
// @entry M06.F01.I07 启用地区限制
// @entry M06.F01.I08 允许地区

const ITEMS: SettingItem[] = [
  {
    id: "M06.F01.I02",
    key: "security.ip.whitelist",
    title: "IP 白名单（逗号分隔）",
    type: "string",
    initialValue: "",
    description: "空 = 不限制",
  },
  {
    id: "M06.F01.I03",
    key: "security.ip.blacklist",
    title: "IP 黑名单（逗号分隔）",
    type: "string",
    initialValue: "",
    description: "命中黑名单直接拒绝",
  },
  {
    id: "M06.F01.I04",
    key: "security.lockout.enabled",
    title: "启用登录失败锁定",
    type: "boolean",
    initialValue: "true",
  },
  {
    id: "M06.F01.I05",
    key: "security.lockout.threshold",
    title: "锁定阈值（连续失败次数）",
    type: "number",
    initialValue: "5",
  },
  {
    id: "M06.F01.I06",
    key: "security.lockout.duration_seconds",
    title: "锁定时长（秒）",
    type: "number",
    initialValue: "1800",
    description: "默认 30 分钟",
  },
  {
    id: "M06.F01.I07",
    key: "security.region.enabled",
    title: "启用地区限制",
    type: "boolean",
    initialValue: "false",
  },
  {
    id: "M06.F01.I08",
    key: "security.region.allowlist",
    title: "允许地区（逗号分隔国家码）",
    type: "string",
    initialValue: "CN,HK,TW,SG",
    description: "ISO 3166-1 alpha-2",
  },
];

export function SecurityClient() {
  return (
    <SettingsDomainClient
      pageTestId="security-page"
      pageFnId="M06.F01.I01"
      pageTitle="登录安全策略"
      prefix="security"
      items={ITEMS}
    />
  );
}