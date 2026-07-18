import "server-only";
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
 * M01.F01.I11 类型契约(tenant) — drizzle handle 必须用 schema 显式传，
 * 否则 $infer 类型只暴露单个表，不能跨表 join。
 */
export const db = drizzle(sqlite, { schema });