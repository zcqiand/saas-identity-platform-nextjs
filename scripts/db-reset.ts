#!/usr/bin/env node
/**
 * db-reset.ts —— drop + recreate 目标 PG 数据库，重新跑 drizzle migrations + seed
 *
 * 背景：
 *   - 旧 saas_dev 库残留 v0.3.0 老 schema（apps 表 id integer + theme 列等），
 *     与 v0.4.x codegen barrel（id text PK，无 theme/sort）不兼容。
 *   - drizzle-kit migrate 假定空 schema；不重置就 ALTER 失败或插入出错。
 *   - 实际工作流必须：drop database → create → migrate → seed
 *
 * 用法：
 *   DATABASE_URL=postgresql://... npm run db:reset
 *   DATABASE_URL=postgresql://... npm run db:reset -- --confirm
 *
 * 安全：
 *   - 默认 dry-run（打印 SQL 计划，不执行）
 *   --confirm 才真正 drop + create
 *   禁止对包含 "prod" / "production" 的库执行
 *
 * 退出码：
 *   0 成功（或 dry-run 完成）
 *   1 DB 连接失败
 *   2 参数错误
 *   3 安全检查未过（含 prod 或缺 --confirm）
 */
import { Client } from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(2);
}

const args = process.argv.slice(2);
const confirm = args.includes("--confirm");
const dryRun = !confirm;

let u: URL;
try {
  u = new URL(url);
} catch (e) {
  console.error("Invalid DATABASE_URL:", (e as Error).message);
  process.exit(2);
}

const dbName = u.pathname.replace(/^\//, "");
if (!dbName) {
  console.error("DATABASE_URL must include a database name");
  process.exit(2);
}

if (/prod/i.test(dbName) || /prod/i.test(u.hostname)) {
  console.error(`Refusing to drop database '${dbName}' on host '${u.hostname}' — contains 'prod'`);
  process.exit(3);
}

const adminDb = u.username || "postgres";
const adminUrl = `${u.protocol}//${u.username ? `${u.username}:${u.password}@` : ""}${u.hostname}${u.port ? `:${u.port}` : ""}/${adminDb}`;

console.log("=== db:reset ===");
console.log(`target database: ${dbName}`);
console.log(`target host:     ${u.hostname}:${u.port || "5432"}`);
console.log(`admin connection: ${adminDb}`);
console.log(`mode:            ${dryRun ? "DRY-RUN (pass --confirm to execute)" : "EXECUTE"}`);
console.log();

console.log("Planned SQL:");
console.log(`  DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE);`);
console.log(`  CREATE DATABASE "${dbName}";`);
console.log();

if (dryRun) {
  console.log("Dry-run complete. Re-run with --confirm to execute.");
  process.exit(0);
}

const c = new Client({ connectionString: adminUrl });
async function run(): Promise<void> {
  try {
    await c.connect();
    await c.query(`DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`);
    await c.query(`CREATE DATABASE "${dbName}"`);
    console.log("db:reset OK — database dropped and recreated");
  } catch (e) {
    console.error("db:reset failed:", (e as Error).message);
    process.exit(1);
  } finally {
    await c.end();
  }
}

void run();