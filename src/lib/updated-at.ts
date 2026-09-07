// src/lib/updated-at.ts — 应用层 updated_at 维护（ADR-0025 D6）
//
// 设计：
// - shared 仓 schema-first 不含 DB 触发器（drizzle-kit 不能生成）
// - 3 后端各自应用层维护 updated_at（springboot @PreUpdate / aspnetcore SaveChanges / nextjs 本文件）
// - Route Handler 在 UPDATE 前调 setUpdatedAt(row)；或批 update 用 touchUpdatedAt(setClause)
//
// 注：本文件是 server-only（Route Handler 内调）

import "server-only";

/**
 * 给一个 row 打上 updatedAt = now()，返回同一对象（便于链式）。
 * 用法：`const updated = setUpdatedAt(row); await db.update(...).set(updated).where(...)`
 */
export function setUpdatedAt<T extends Record<string, unknown>>(
  row: T,
  now: Date = new Date(),
): T {
  return { ...row, updatedAt: now };
}

/**
 * 直接生成 SQL 片段；用于 .set(sql\`updated_at = NOW()\`) 等场景。
 * 用法：`await db.update(t).set({ ...other, updatedAt: sql\`NOW()\` }).where(...)`
 */
export { sql } from "drizzle-orm";
