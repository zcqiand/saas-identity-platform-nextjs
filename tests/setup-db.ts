/**
 * per-fork-process schema 隔离（Option A: globalSetup + per-pid schema）。
 *
 * 历史 bug（root cause 已实测，见 task-5-fix1-report.md）：
 *   旧版用 `WORKER_ID = test_${VITEST_POOL_ID ?? pid}`，依赖 vitest 的 pool_id。
 *   实测：forks pool 下**每个测试文件**都是一个全新的子进程，但同一个 pool 内
 *   的多个文件共享同一个 `VITEST_POOL_ID`。两个文件先后落到 pool_id=1：
 *   都建 `test_1` schema，都灌迁移，第二个的 CREATE TABLE 撞到第一个刚建的
 *   `api_keys` —— `relation "api_keys" already exists`。
 *
 * 修复策略（与 brief Option A 一致）：
 *   - schema 名按 `process.pid` 派生（forks pool 每文件一进程，pid 全局唯一）。
 *   - 模块顶层同步注入 VITEST_SCHEMA，确保被测文件 import @/db 时 open() 读到它。
 *   - 每个 fork 进程独立 globalThis，db 单例各自 open()，search_path 指向自己的
 *     schema，无串号风险。
 *   - beforeAll: CREATE SCHEMA IF NOT EXISTS + 仅在本进程未迁移过时灌一次迁移
 *     （globalThis.__migrated 防御同一进程内 beforeAll 被多次触发的边界）。
 *   - afterAll: 不删 schema、不 end pool —— 由 globalSetup teardown 统一清扫所有
 *     `test_*` schema，保证哪怕进程崩溃也有兜底。
 *   - globalSetup 同时负责启动前清扫陈旧 schema（来自上次崩溃的残留）。
 */
import { afterAll, beforeAll } from "vitest";
import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __migrated: Record<string, true> | undefined;
}

// 模块顶层同步：派生唯一 schema 名 + 注入 env（被测 @/db open() 依赖）。
const ROOT_URL = process.env.DATABASE_URL;
if (!ROOT_URL) {
  throw new Error("DATABASE_URL must point at *_test db in vitest (.env.test)");
}
// pid 在 forks pool 全局唯一；加 Math.random 兜底防止极端情况下 pid 复用。
const SCHEMA = `test_${process.pid}_${Math.random().toString(36).slice(2, 8)}`;
if (!process.env.VITEST_SCHEMA) {
  process.env.VITEST_SCHEMA = SCHEMA;
}

// bootstrap pool：建 schema（不做查询路由，不挂 search_path）。
const bootstrap = new Pool({ connectionString: ROOT_URL });

// admin pool：跑迁移，每条连接默认 search_path 指向本进程 schema。
const admin = new Pool({
  connectionString: ROOT_URL,
  options: `-c search_path=${SCHEMA},public`,
});

/**
 * 读 drizzle 迁移 journal，按顺序取每个 *.sql，剥掉 "public". 前缀后逐条执行。
 * 在 admin pool 的一个连接上以事务跑，保证原子性。
 *
 * 为什么不用 drizzle-orm/node-postgres 的 migrate()：生成的迁移 SQL 里 FK 写死了
 * REFERENCES "public"."apps" —— search_path 无法改写已显式 schema-qualified 的引用。
 * 解法：手工剥 "public". 让 FK 落到 unqualified，由 search_path 解析到本进程 schema。
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
  await bootstrap.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA}`);
  // 同一 fork 进程内若 beforeAll 被多次触发（多个 describe 顶层），只灌一次。
  if (!globalThis.__migrated?.[SCHEMA]) {
    await applyMigrations();
    globalThis.__migrated = { ...(globalThis.__migrated ?? {}), [SCHEMA]: true };
  }
});

// afterAll 不做清理：globalSetup teardown 统一 DROP 所有 test_* schema。
// pool 由 process beforeExit 钩子（src/db/index.ts 已注册）+ 进程退出自然回收。
afterAll(async () => {
  await admin.end();
  await bootstrap.end();
});
