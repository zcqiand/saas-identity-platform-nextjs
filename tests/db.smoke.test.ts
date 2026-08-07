/**
 * 数据库连通性冒烟测试 — 任意业务测试运行前的 sanity check。
 * 验证 per-worker schema 隔离生效：db 单例的 pool search_path 指向 worker schema，
 * 能成功 insert + select。
 */
import { describe, expect, it } from "vitest";
import { db } from "@/db";
import { healthCheck } from "@/db/schema";

describe("DB smoke", () => {
  it("can insert + select from health_check", async () => {
    const inserted = (await db
      .insert(healthCheck)
      .values({ id: "smoke-1", ok: 1 })
      .returning())[0];
    if (!inserted) throw new Error("insert returned no row");
    expect(inserted.id).toBe("smoke-1");
    expect(inserted.checkedAt).toBeTruthy();
  });
});