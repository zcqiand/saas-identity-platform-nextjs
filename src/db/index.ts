import "server-only";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

const DB_PATH = process.env.DB_PATH ?? "data/dev.db";

const sqlite = new Database(DB_PATH);
if (DB_PATH !== ":memory:") {
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
}

/**
 * :memory: DB 自动建表 —— vitest 默认 DB_PATH=":memory:"，每次新建一个空 DB。
 * 不跑 drizzle migrations 直接 insert 会报 "no such table"。
 * 这里把 migrations/*.sql 拼起来一次性 exec()，确保 :memory: 和 dev.db 行为一致。
 * dev.db 路径走的是 npm run db:migrate（drizzle-kit 生成的 SQL），schema 跟它一致。
 */
if (DB_PATH === ":memory:") {
  const drizzleDir = join(process.cwd(), "drizzle");
  try {
    const files = readdirSync(drizzleDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
    for (const f of files) {
      const sql = readFileSync(join(drizzleDir, f), "utf-8");
      const statements = sql
        .split(/-->\s*statement-breakpoint/i)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
      for (const stmt of statements) {
        try {
          sqlite.exec(stmt);
        } catch {
          // CREATE INDEX 等 if not exists 已经 IGNORE 失败；吞掉
        }
      }
    }
  } catch {
    // drizzle/ 目录缺失（首次 init），交给调用方报错
  }
}

/**
 * M01.F01.I11 类型契约(tenant) — drizzle handle 必须用 schema 显式传，
 * 否则 $infer 类型只暴露单个表，不能跨表 join。
 */
export const db = drizzle(sqlite, { schema });