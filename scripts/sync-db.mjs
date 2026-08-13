// scripts/sync-db.mjs - 把 shared/sql/migrations/*.sql 同步到 saas_dev 并 tracking
//
// 背景:shared 仓 sql/migrations/ 是 Flyway 风格 (V<NNN>__<desc>.sql),
// nextjs 用 node-pg-migrate 期望 <timestamp>_<name>.sql 命名。
// 两套规范不直接互通——本脚本做适配:
//   1. 读 shared/sql/migrations/*.sql(V 开头)
//   2. 查 saas_dev.__schema_migrations 已 apply 列表
//   3. 对未 apply 的 V 文件,逐个用 pg 客户端 raw SQL 执行 + INSERT tracking
//   4. 幂等:可重跑,已 apply 的会自动跳过
//
// 用法:
//   node scripts/sync-db.mjs                     # 默认连 saas_dev
//   DATABASE_URL=postgresql://... node scripts/sync-db.mjs

import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, readdirSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const NEXTJS_ROOT = resolve(__dirname, "..");
const SHARED_SQL_DIR = resolve(
  NEXTJS_ROOT,
  "../saas-identity-platform-shared/sql/migrations",
);

const require = createRequire(resolve(NEXTJS_ROOT, "package.json"));
const pg = require("pg");

const DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/saas_dev";

function loadMigrations() {
  // Flyway 风格 V*.sql;按 V 编号排序
  const files = readdirSync(SHARED_SQL_DIR).filter((f) => /^V\d+__/.test(f));
  return files.sort((a, b) => {
    const na = parseInt(a.match(/^V(\d+)/)[1], 10);
    const nb = parseInt(b.match(/^V(\d+)/)[1], 10);
    return na - nb;
  });
}

const client = new pg.Client({
  connectionString: DATABASE_URL,
  connectionTimeoutMillis: 10000,
});

try {
  console.log(
    `[sync-db] 连接 ${DATABASE_URL.replace(/:[^:@/]+@/, ":***@")} ...`,
  );
  await client.connect();
  console.log("[sync-db] 已连接。");

  // 1. 确保 __schema_migrations tracking 表存在(saas_dev 已有;新库则创建)
  await client.query(`
    CREATE TABLE IF NOT EXISTS __schema_migrations (
      version    VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. 读已 apply 版本
  const { rows: applied } = await client.query(
    `SELECT version FROM __schema_migrations ORDER BY version`,
  );
  const appliedSet = new Set(applied.map((r) => r.version));
  console.log(`[sync-db] saas_dev 已 apply ${appliedSet.size} 个 migration:`,
    Array.from(appliedSet).join(", ") || "(none)");

  // 3. 读 shared 待 apply
  const files = loadMigrations();
  console.log(`[sync-db] shared 待 apply ${files.length} 个 migration:`,
    files.map((f) => f.replace(/^V(\d+)__/, "V$1 ")).join(", "));

  // 4. 逐个 apply(跳过已存在的)
  let appliedNow = 0;
  for (const f of files) {
    if (appliedSet.has(f)) continue;
    const sql = readFileSync(resolve(SHARED_SQL_DIR, f), "utf-8");
    console.log(`[sync-db] -> apply ${f} ...`);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(
        `INSERT INTO __schema_migrations (version, applied_at) VALUES ($1, CURRENT_TIMESTAMP)`,
        [f],
      );
      await client.query("COMMIT");
      console.log(`[sync-db]    OK + tracking`);
      appliedNow++;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[sync-db]    FAIL ${f}: ${err.message}`);
      throw err;
    }
  }

  if (appliedNow === 0) {
    console.log("[sync-db] ✅ 无新 migration 需要 apply(全部已 tracking)。");
  } else {
    console.log(`[sync-db] ✅ apply 完 ${appliedNow} 个 migration。`);
  }

  // 5. 打印当前状态
  const { rows: final } = await client.query(
    `SELECT version, applied_at FROM __schema_migrations ORDER BY version`,
  );
  console.log("\n[sync-db] 当前 __schema_migrations:");
  for (const r of final) {
    console.log(`  ${r.version.padEnd(50)} ${r.applied_at.toISOString()}`);
  }
} catch (err) {
  console.error("\n[sync-db] ERROR:", err.message);
  if (err.position) console.error("  位置(字节):", err.position);
  process.exit(1);
} finally {
  await client.end().catch(() => {});
}
