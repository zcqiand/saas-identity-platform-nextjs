import "server-only";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

declare global {
  var __drizzle: Db | undefined;
}

function open(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  // 测试期由 tests/setup-db.ts 注入：每 worker 一个 schema，靠 pool options
  // 设 search_path 让 db 单例的所有查询落到该 schema。
  const testSchema = process.env.VITEST_SCHEMA;
  const pool = new Pool({
    connectionString: url,
    ...(testSchema ? { options: `-c search_path=${testSchema},public` } : {}),
  });
  return drizzle(pool, { schema });
}

export const db: Db = globalThis.__drizzle ?? (globalThis.__drizzle = open());

// 测试 teardown / 进程退出时关池，避免挂在已结束的 worker。
if (process.env.NODE_ENV === "test") {
  process.on("beforeExit", async () => {
    try {
      const pool = (db as unknown as { pool?: Pool }).pool;
      await pool?.end();
    } catch {
      /* noop */
    }
  });
}
