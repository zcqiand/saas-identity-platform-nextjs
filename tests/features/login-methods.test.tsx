/**
 * M06.F11 登录方式（fn-ID M06.F11.I01-I04）
 *
 * 数据：login_methods 表（6 种登录方式开关）。
 *
 * 覆盖：I01 列表 / I02 查询单个 / I03 启用/禁用 / I04 store 内部接口
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  listLoginMethods,
  getLoginMethod,
  updateLoginMethod,
} from "@/lib/login-method-store";
import { seedDatabase } from "@/db/seed";
import { db } from "@/db";
import { loginMethods } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fnTest } from "../fn";

beforeAll(async () => {
  await seedDatabase();
});

describe("M06.F11 login methods", () => {
  fnTest(["M06.F11.I01"], "I01 登录方式列表（灌库后至少 1 行）", async () => {
    const rows = await listLoginMethods();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.method).toBeTruthy();
      expect(row.name).toBeTruthy();
    }
  });

  fnTest(["M06.F11.I01"], "I01 列表里每行都有 sort（启用排序的 UI 控制）", async () => {
    const rows = await listLoginMethods();
    for (const row of rows) {
      expect(typeof row.sort).toBe("number");
    }
  });

  fnTest(["M06.F11.I02"], "I02 查询单个登录方式（按 id）", async () => {
    const all = await listLoginMethods();
    expect(all.length).toBeGreaterThan(0);
    const first = all[0]!;
    const found = await getLoginMethod(first.id);
    expect(found).toBeTruthy();
    expect(found!.id).toBe(first.id);
    expect(found!.method).toBe(first.method);
  });

  fnTest(["M06.F11.I02"], "I02 不存在的 id 返回 null", async () => {
    const found = await getLoginMethod("login-method-not-exist");
    expect(found).toBeNull();
  });

  fnTest(["M06.F11.I03"], "I03 启用/禁用登录方式（enabled toggle）", async () => {
    const all = await listLoginMethods();
    const target = all[0]!;
    const before = target.enabled;

    const updated = await updateLoginMethod(target.id, {
      enabled: !before,
    });
    expect(updated).toBeTruthy();
    expect(updated!.enabled).toBe(!before);

    // 真的落到数据库
    const [row] = await db
      .select()
      .from(loginMethods)
      .where(eq(loginMethods.id, target.id));
    expect(row!.enabled).toBe(!before);
  });

  fnTest(["M06.F11.I03"], "I03 改 sort（启用排序）", async () => {
    const all = await listLoginMethods();
    const target = all[0]!;
    const newSort = (target.sort ?? 0) + 100;
    const updated = await updateLoginMethod(target.id, { sort: newSort });
    expect(updated).toBeTruthy();
    expect(updated!.sort).toBe(newSort);
  });

  fnTest(["M06.F11.I03"], "I03 不存在的 id 返回 null", async () => {
    const updated = await updateLoginMethod("login-method-not-exist", {
      enabled: true,
    });
    expect(updated).toBeNull();
  });

  fnTest(["M06.F11.I04"], "I04 store 内部接口：shared seed 中每个 login_method 都有 method + name", async () => {
    const rows = await db.select().from(loginMethods);
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.method).toBeTruthy();
      expect(row.name).toBeTruthy();
      // description 可以为空（nullable）
    }
  });

  it("M06.F11 list 后 sort 字段是 number（不是 string）", async () => {
    const rows = await listLoginMethods();
    for (const row of rows) {
      expect(typeof row.sort).toBe("number");
    }
  });
});