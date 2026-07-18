/**
 * 数据库连通性冒烟测试 — 任意业务测试运行前的 sanity check。
 * 如果这个都挂，那是 :memory: SQLite / drizzle / globalThis 单例的 setup 有问题。
 */
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { healthCheck } from "@/db/schema";

describe("DB smoke", () => {
  it("can insert + select from health_check", () => {
    const inserted = db.insert(healthCheck).values({ ok: 1 }).returning().get();
    expect(inserted.id).toBeGreaterThan(0);
    expect(inserted.checkedAt).toBeTruthy();
  });
});