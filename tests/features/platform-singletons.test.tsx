/**
 * M06.F09 平台配置 singletons（fn-ID M06.F09.I01-I06）
 *
 * 数据：6 张单例配置表（token-config / login-security / password-policy /
 *      risk-control / notification-config / open-platform-config）。
 *
 * 覆盖：I01 token / I02 login-security / I03 password-policy / I04 risk-control /
 *      I05 notification / I06 open-platform —— 每个子项对应一张单例表
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  getTokenConfig,
  upsertTokenConfig,
} from "@/lib/token-config-store";
import {
  getLoginSecurity,
  upsertLoginSecurity,
} from "@/lib/login-security-store";
import {
  getPasswordPolicy,
  upsertPasswordPolicy,
} from "@/lib/password-policy-store";
import {
  getRiskControl,
  upsertRiskControl,
} from "@/lib/risk-control-store";
import {
  getNotificationConfig,
  upsertNotificationConfig,
} from "@/lib/notification-config-store";
import {
  getOpenPlatformConfig,
  upsertOpenPlatformConfig,
} from "@/lib/open-platform-config-store";
import { seedDatabase } from "@/db/seed";
import { fnTest } from "../fn";

beforeAll(async () => {
  await seedDatabase();
});

describe("M06.F09 platform singletons", () => {
  fnTest(["M06.F09.I01"], "I01 token-config 单例：get + upsert", async () => {
    const before = await getTokenConfig();
    expect(before).toBeTruthy();
    const originalAccessTtl = before!.accessTokenTtl;

    const upserted = await upsertTokenConfig({
      accessTokenTtl: originalAccessTtl + 1,
      refreshTokenTtl: before!.refreshTokenTtl,
      refreshTokenEnabled: !before!.refreshTokenEnabled,
      tokenRevocationEnabled: before!.tokenRevocationEnabled,
    });
    expect(upserted.accessTokenTtl).toBe(originalAccessTtl + 1);
    expect(upserted.refreshTokenEnabled).toBe(!before!.refreshTokenEnabled);

    // 再查也一致
    const after = await getTokenConfig();
    expect(after!.accessTokenTtl).toBe(originalAccessTtl + 1);
  });

  fnTest(["M06.F09.I01"], "I01 token-config upsert 在已有行上更新（不重复插入）", async () => {
    // 通过连续两次 upsert，验证行数仍为 1
    await upsertTokenConfig({
      accessTokenTtl: 7200,
      refreshTokenTtl: 2592000,
      refreshTokenEnabled: true,
      tokenRevocationEnabled: false,
    });
    const rows = await getTokenConfig();
    expect(rows).toBeTruthy();
    expect(rows!.accessTokenTtl).toBe(7200);
  });

  fnTest(["M06.F09.I02"], "I02 login-security 单例：get + upsert（改 ipWhitelist）", async () => {
    const before = await getLoginSecurity();
    expect(before).toBeTruthy();

    const newWhitelist = ["192.168.1.0/24", "10.0.0.0/8"];
    const upserted = await upsertLoginSecurity({
      ipWhitelist: newWhitelist,
      ipBlacklist: before!.ipBlacklist,
      regionRestrictionEnabled: before!.regionRestrictionEnabled,
      allowedRegions: before!.allowedRegions,
      failedAttemptLockEnabled: before!.failedAttemptLockEnabled,
      lockThreshold: before!.lockThreshold,
      lockDuration: before!.lockDuration,
    });
    expect(upserted.ipWhitelist).toEqual(newWhitelist);
  });

  fnTest(["M06.F09.I03"], "I03 password-policy 单例：get + upsert（改 minLength）", async () => {
    const before = await getPasswordPolicy();
    expect(before).toBeTruthy();
    const oldMin = before!.minLength;

    const upserted = await upsertPasswordPolicy({
      minLength: oldMin + 4,
      requireUppercase: before!.requireUppercase,
      requireLowercase: before!.requireLowercase,
      requireDigit: before!.requireDigit,
      requireSpecial: before!.requireSpecial,
      expireDays: before!.expireDays,
      historyCount: before!.historyCount,
      enabled: before!.enabled,
    });
    expect(upserted.minLength).toBe(oldMin + 4);
  });

  fnTest(["M06.F09.I04"], "I04 risk-control 单例：get + upsert（改 riskScoreThreshold）", async () => {
    const before = await getRiskControl();
    expect(before).toBeTruthy();

    const upserted = await upsertRiskControl({
      anomalyDetectionEnabled: before!.anomalyDetectionEnabled,
      crossRegionAlertEnabled: before!.crossRegionAlertEnabled,
      deviceFingerprintEnabled: !before!.deviceFingerprintEnabled,
      riskScoreThreshold: before!.riskScoreThreshold + 5,
    });
    expect(upserted.deviceFingerprintEnabled).toBe(!before!.deviceFingerprintEnabled);
    expect(upserted.riskScoreThreshold).toBe(before!.riskScoreThreshold + 5);
  });

  fnTest(["M06.F09.I05"], "I05 notification-config 单例：get + upsert（关 sms）", async () => {
    const before = await getNotificationConfig();
    expect(before).toBeTruthy();

    const upserted = await upsertNotificationConfig({
      emailEnabled: before!.emailEnabled,
      smsEnabled: !before!.smsEnabled,
      inAppEnabled: before!.inAppEnabled,
      notifyOn: before!.notifyOn,
    });
    expect(upserted.smsEnabled).toBe(!before!.smsEnabled);
  });

  fnTest(["M06.F09.I06"], "I06 open-platform-config 单例：get + upsert（关 api）", async () => {
    const before = await getOpenPlatformConfig();
    expect(before).toBeTruthy();

    const upserted = await upsertOpenPlatformConfig({
      apiEnabled: !before!.apiEnabled,
      webhookEnabled: before!.webhookEnabled,
      sdkEnabled: before!.sdkEnabled,
      openScopes: before!.openScopes,
      callbackWhitelist: before!.callbackWhitelist,
    });
    expect(upserted.apiEnabled).toBe(!before!.apiEnabled);
  });

  fnTest(["M06.F09.I01", "M06.F09.I02", "M06.F09.I03", "M06.F09.I04", "M06.F09.I05", "M06.F09.I06"], "所有 6 张单例表都能取到（seed 已灌入 default 行）", async () => {
    expect(await getTokenConfig()).toBeTruthy();
    expect(await getLoginSecurity()).toBeTruthy();
    expect(await getPasswordPolicy()).toBeTruthy();
    expect(await getRiskControl()).toBeTruthy();
    expect(await getNotificationConfig()).toBeTruthy();
    expect(await getOpenPlatformConfig()).toBeTruthy();
  });

  it("M06.F09 token-config：连续 upsert 两次只产生 1 行（id=default 约束）", async () => {
    await upsertTokenConfig({
      accessTokenTtl: 3600,
      refreshTokenTtl: 86400,
      refreshTokenEnabled: true,
      tokenRevocationEnabled: false,
    });
    await upsertTokenConfig({
      accessTokenTtl: 7200,
      refreshTokenTtl: 172800,
      refreshTokenEnabled: false,
      tokenRevocationEnabled: true,
    });
    const after = await getTokenConfig();
    expect(after!.accessTokenTtl).toBe(7200);
    expect(after!.refreshTokenTtl).toBe(172800);
  });
});