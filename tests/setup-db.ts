/**
 * per-worker schema 隔离：每个 vitest worker 进程在 saas_test 库建独立 schema，
 * 把 drizzle 迁移文件灌进去（剥掉 "public". 前缀后让 search_path 决定归属），
 * 并让 db 句柄（src/db/index.ts 单例）的 pool 默认 search_path 指向它。
 *
 * 模块加载一次（per worker），beforeAll/afterAll 即 worker 生命周期。
 *
 * 时序要点：
 *   - VITEST_SCHEMA 在模块顶层同步赋值，保证被测文件 import @/db 时 open()
 *     能读到它（setup-db 是 setupFiles 第一项，test file 的 import 在其后）。
 *   - VITEST_POOL_ID 由 vitest 注入；fallback 用 pid 兜底（默认 forks pool 一定有 id）。
 *
 * 为什么不用 drizzle-orm/node-postgres 的 migrate()：
 *   生成的迁移 SQL 里 FK 写死了 REFERENCES "public"."apps" —— search_path 无法
 *   改写已显式 schema-qualified 的引用。drizzle migrator 跑这些语句时会去 public
 *   找表，而我们的表在 worker schema，于是 "relation public.apps does not exist"。
 *   解法：手工读 drizzle/meta/_journal.json 按顺序取 *.sql，把 "public". 剥掉
 *   （让 FK 落到 unqualified，由 search_path 解析到 worker schema），再逐条执行。
 *   worker schema 每 worker 全新创建后 DROP，不需要迁移版本表。
 */
import { afterAll, beforeAll } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WORKER_ID = `test_${process.env.VITEST_POOL_ID ?? process.pid}`;
const ROOT_URL = process.env.DATABASE_URL;
if (!ROOT_URL) {
  throw new Error("DATABASE_URL must point at *_test db in vitest (.env.test)");
}

// 注入 worker schema —— src/db/index.ts open() 读它构造 pool options。
// 必须在模块加载时（同步）完成，早于任何 test file 的 import @/db。
process.env.VITEST_SCHEMA = WORKER_ID;

// bootstrap pool：建/删 schema（admin pool 的 search_path 已锁到 worker schema，
// 用来在那里跑 DDL 反而不直观，分开管理更清晰）。
const bootstrap = new Pool({ connectionString: ROOT_URL });

// admin pool：跑迁移。每条连接 search_path 默认指向 worker schema。
// 用 Pool 而非单连接：迁移本身无并发，Pool 给的连接都会带 options，行为一致。
const admin = new Pool({
  connectionString: ROOT_URL,
  options: `-c search_path=${WORKER_ID},public`,
});

/**
 * 读 drizzle 迁移 journal，按顺序取每个 *.sql，剥掉 "public". 前缀后逐条执行。
 * 在 admin pool 的一个连接上以事务跑，保证原子性。
 */
async function applyMigrations(): Promise<void> {
  const journalPath = resolve(process.cwd(), "drizzle/meta/_journal.json");
  const journal = JSON.parse(readFileSync(journalPath, "utf8")) as {
    entries: { idx: number; tag: string }[];
  };
  const client = await admin.connect();
  try {
    await client.query("BEGIN");
    for (const entry of journal.entries) {
      const file = `${entry.tag}.sql`;
      const raw = readFileSync(resolve(process.cwd(), "drizzle", file), "utf8");
      // 剥掉 "public". 让 unqualified 引用由 search_path 解析到 worker schema。
      const sql = raw.replace(/"public"\./g, "");
      const stmts = sql
        .split("--> statement-breakpoint")
        .map((s) => s.trim())
        .filter(Boolean);
      for (const stmt of stmts) {
        await client.query(stmt);
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

beforeAll(async () => {
  await bootstrap.query(`CREATE SCHEMA IF NOT EXISTS ${WORKER_ID}`);
  await applyMigrations();
});

afterAll(async () => {
  await admin.end();
  await bootstrap.query(`DROP SCHEMA IF EXISTS ${WORKER_ID} CASCADE`);
  await bootstrap.end();
});
