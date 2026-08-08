#!/usr/bin/env node
/**
 * sync-db-pg.ts —— 把 shared 仓 codegen 输出同步到本仓 src/db/generated/db.pg.ts
 *
 * 背景：
 *   - shared 仓 manifest → `scripts/codegen/emit-ts.ts` → `scripts/codegen/generated/db.pg.ts`
 *   - nextjs 仓 `src/db/schema.ts` 通过 `export * from "./generated/db.pg"` 消费 barrel
 *   - 由于 shared 仓 CLAUDE.md 禁止非 zod+dev 依赖，且 TS bundler-resolver 找不到
 *     `node_modules/drizzle-orm` 在 file: 子目录里，shared 不能 export 给 consumer
 *   - 改用 file copy 同步：nextjs 仓本地维护 `src/db/generated/db.pg.ts`
 *
 * 用法：
 *   npm run sync:db-pg            （从 shared 同步到 nextjs）
 *   npm run sync:db-pg -- --check  （CI/手写 diff：检查文件是否最新，不更新）
 *
 * 退出码：
 *   0 同步成功且无 drift
 *   1 shared emit:ts 失败
 *   2 file drift（--check 模式）
 *   3 路径解析错误
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HERE = __dirname;
const ROOT = resolve(HERE, "..");
const SHARED_ROOT = resolve(ROOT, "..", "saas-identity-platform-shared");
const SRC = join(SHARED_ROOT, "scripts", "codegen", "generated", "db.pg.ts");
const DEST = join(ROOT, "src", "db", "generated", "db.pg.ts");

const args = process.argv.slice(2);
const checkOnly = args.includes("--check");

async function main(): Promise<void> {
  if (!existsSync(SHARED_ROOT)) {
    console.error(`shared submodule not found: ${SHARED_ROOT}`);
    process.exit(3);
  }

  if (!checkOnly) {
    console.log("[sync-db-pg] running shared emit:ts ...");
    try {
      execFileSync("npm.cmd", ["run", "emit:ts"], {
        cwd: SHARED_ROOT,
        stdio: "inherit",
        shell: true,
      });
    } catch (e) {
      console.error("[sync-db-pg] shared emit:ts failed:", e);
      process.exit(1);
    }
  }

  if (!existsSync(SRC)) {
    console.error(`generated file missing: ${SRC}`);
    process.exit(3);
  }

  if (checkOnly) {
    if (!existsSync(DEST)) {
      console.error(`[sync-db-pg] DRIFT: ${relative(ROOT, DEST)} 不存在`);
      process.exit(2);
    }
    const [current, expected] = await Promise.all([readFile(DEST), readFile(SRC)]);
    if (current.equals(expected)) {
      console.log("[sync-db-pg] up to date");
      process.exit(0);
    }
    console.error(`[sync-db-pg] DRIFT: ${relative(ROOT, DEST)} vs ${relative(ROOT, SRC)}`);
    process.exit(2);
  }

  copyFileSync(SRC, DEST);
  console.log(`[sync-db-pg] synced → ${relative(ROOT, DEST)}`);
}

main().catch((e: unknown) => {
  console.error("[sync-db-pg] unexpected error:", e);
  process.exit(3);
});