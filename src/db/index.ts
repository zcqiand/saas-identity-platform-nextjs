import "server-only";
import { Pool } from "pg";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

export type Db = NodePgDatabase<typeof schema>;

declare global {
  // eslint-disable-next-line no-var
  var __drizzle: Db | undefined;
}

function open(): Db {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: url });
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
