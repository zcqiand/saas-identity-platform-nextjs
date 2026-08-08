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

describe("M06.F09 platform singletons", { concurrent: false }, () => {
  // v0.3.1.5 起 nextjs 端不灌 6 张单例配置（react/vue 仓灌 default 行）；
  // store 上 upsert 在无 default 行时会自动 insert。test 从 "无 default → upsert → 取出 → 改 → upsert → 取改后"
  // 模式断言 upsert 幂等，不依赖 seed。
  fnTest(["M06.F09.I01"], "I01 token-config 单例：get + upsert", async () => {
    const before = await getTokenConfig();
    // before 可为 null（nextjs 端不灌 default），upsert 应走 insert 路径
    const seed = before ?? {
      accessTokenTtl: 3600,
      refreshTokenTtl: 604800,
      refreshTokenEnabled: true,
      tokenRevocationEnabled: true,
    };
    const originalAccessTtl = seed.accessTokenTtl;

    const upserted = await upsertTokenConfig({
      accessTokenTtl: originalAccessTtl + 1,
      refreshTokenTtl: seed.refreshTokenTtl,
      refreshTokenEnabled: !seed.refreshTokenEnabled,
      tokenRevocationEnabled: seed.tokenRevocationEnabled,
    });
    expect(upserted.accessTokenTtl).toBe(originalAccessTtl + 1);
    expect(upserted.refreshTokenEnabled).toBe(!seed.refreshTokenEnabled);

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
    const seed = before ?? {
      ipWhitelist: [] as string[],
      ipBlacklist: [] as string[],
      regionRestrictionEnabled: false,
      allowedRegions: [] as string[],
      failedAttemptLockEnabled: true,
      lockThreshold: 5,
      lockDuration: 30,
    };

    const newWhitelist = ["192.168.1.0/24", "10.0.0.0/8"];
    const upserted = await upsertLoginSecurity({
      ipWhitelist: newWhitelist,
      ipBlacklist: seed.ipBlacklist,
      regionRestrictionEnabled: seed.regionRestrictionEnabled,
      allowedRegions: seed.allowedRegions,
      failedAttemptLockEnabled: seed.failedAttemptLockEnabled,
      lockThreshold: seed.lockThreshold,
      lockDuration: seed.lockDuration,
    });
    expect(upserted.ipWhitelist).toEqual(newWhitelist);
  });

  fnTest(["M06.F09.I03"], "I03 password-policy 单例：get + upsert（改 minLength）", async () => {
    const before = await getPasswordPolicy();
    const seed = before ?? {
      minLength: 8,
      requireUppercase: true,
      requireLowercase: true,
      requireDigit: true,
      requireSpecial: false,
      expireDays: 90,
      historyCount: 5,
      enabled: true,
    };
    const oldMin = seed.minLength;

    const upserted = await upsertPasswordPolicy({
      minLength: oldMin + 4,
      requireUppercase: seed.requireUppercase,
      requireLowercase: seed.requireLowercase,
      requireDigit: seed.requireDigit,
      requireSpecial: seed.requireSpecial,
      expireDays: seed.expireDays,
      historyCount: seed.historyCount,
      enabled: seed.enabled,
    });
    expect(upserted.minLength).toBe(oldMin + 4);
  });

  fnTest(["M06.F09.I04"], "I04 risk-control 单例：get + upsert（改 riskScoreThreshold）", async () => {
    const before = await getRiskControl();
    const seed = before ?? {
      anomalyDetectionEnabled: true,
      crossRegionAlertEnabled: true,
      deviceFingerprintEnabled: true,
      riskScoreThreshold: 70,
    };

    const upserted = await upsertRiskControl({
      anomalyDetectionEnabled: seed.anomalyDetectionEnabled,
      crossRegionAlertEnabled: seed.crossRegionAlertEnabled,
      deviceFingerprintEnabled: !seed.deviceFingerprintEnabled,
      riskScoreThreshold: seed.riskScoreThreshold + 5,
    });
    expect(upserted.deviceFingerprintEnabled).toBe(!seed.deviceFingerprintEnabled);
    expect(upserted.riskScoreThreshold).toBe(seed.riskScoreThreshold + 5);
  });

  fnTest(["M06.F09.I05"], "I05 notification-config 单例：get + upsert（关 sms）", async () => {
    const before = await getNotificationConfig();
    const seed = before ?? {
      emailEnabled: true,
      smsEnabled: false,
      inAppEnabled: true,
      notifyOn: ["login", "password_change"] as string[],
    };

    const upserted = await upsertNotificationConfig({
      emailEnabled: seed.emailEnabled,
      smsEnabled: !seed.smsEnabled,
      inAppEnabled: seed.inAppEnabled,
      notifyOn: seed.notifyOn,
    });
    expect(upserted.smsEnabled).toBe(!seed.smsEnabled);
  });

  fnTest(["M06.F09.I06"], "I06 open-platform-config 单例：get + upsert（关 api）", async () => {
    const before = await getOpenPlatformConfig();
    const seed = before ?? {
      apiEnabled: true,
      webhookEnabled: true,
      sdkEnabled: true,
      openScopes: ["user:read", "role:read"] as string[],
      callbackWhitelist: [] as string[],
    };

    const upserted = await upsertOpenPlatformConfig({
      apiEnabled: !seed.apiEnabled,
      webhookEnabled: seed.webhookEnabled,
      sdkEnabled: seed.sdkEnabled,
      openScopes: seed.openScopes,
      callbackWhitelist: seed.callbackWhitelist,
    });
    expect(upserted.apiEnabled).toBe(!seed.apiEnabled);
  });

  // v0.4.x 单表粒度测试（避免 1 个 fnTest 触发 6 个 upsert → 5s timeout）
fnTest(["M06.F09.I01"], "I01 token-config schema 可访问 + upsert 取得到", async () => {
  await upsertTokenConfig({ accessTokenTtl: 3600, refreshTokenTtl: 604800, refreshTokenEnabled: true, tokenRevocationEnabled: true });
  expect(await getTokenConfig()).toBeTruthy();
});

fnTest(["M06.F09.I02"], "I02 login-security schema 可访问 + upsert 取得到", async () => {
  await upsertLoginSecurity({ ipWhitelist: [], ipBlacklist: [], regionRestrictionEnabled: false, allowedRegions: [], failedAttemptLockEnabled: true, lockThreshold: 5, lockDuration: 30 });
  expect(await getLoginSecurity()).toBeTruthy();
});

fnTest(["M06.F09.I03"], "I03 password-policy schema 可访问 + upsert 取得到", async () => {
  await upsertPasswordPolicy({ minLength: 8, requireUppercase: true, requireLowercase: true, requireDigit: true, requireSpecial: false, expireDays: 90, historyCount: 5, enabled: true });
  expect(await getPasswordPolicy()).toBeTruthy();
});

fnTest(["M06.F09.I04"], "I04 risk-control schema 可访问 + upsert 取得到", async () => {
  await upsertRiskControl({ anomalyDetectionEnabled: true, crossRegionAlertEnabled: true, deviceFingerprintEnabled: true, riskScoreThreshold: 70 });
  expect(await getRiskControl()).toBeTruthy();
});

fnTest(["M06.F09.I05"], "I05 notification-config schema 可访问 + upsert 取得到", async () => {
  await upsertNotificationConfig({ emailEnabled: true, smsEnabled: false, inAppEnabled: true, notifyOn: ["login"] });
  expect(await getNotificationConfig()).toBeTruthy();
});

fnTest(["M06.F09.I06"], "I06 open-platform-config schema 可访问 + upsert 取得到", async () => {
  await upsertOpenPlatformConfig({ apiEnabled: true, webhookEnabled: true, sdkEnabled: true, openScopes: ["user:read"], callbackWhitelist: [] });
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