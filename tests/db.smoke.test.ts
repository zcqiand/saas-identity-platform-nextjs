// DB smoke test：跑 PG 连接 + 跑 shared migrations + select 1。
//
// 跳过条件：DATABASE_URL 未设 / `npm install` 没装 pg 时。CI 实跑。
// SSR 环境（Next.js server-only）：src/db/index.ts 顶部有 `import "server-only"`，
// 所以测试必须放到 vitest node 环境，且不走 Next bundler。

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// 借 pg 来自 sibling（nextjs 仓不直接 dep pg；通过 postgres-js 间接）
// 测试中直接用 pg.Client 是简化路径，避 postgres-js 实例化对环境的隐式依赖
type PgClient = {
  connect(): Promise<void>;
  query(sql: string, params?: unknown[]): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
  end(): Promise<void>;
};

let pgModule: { Client: new (cfg: unknown) => PgClient } | null = null;
try {
  // postgres-js 暴露其底层 pg；borrow it
  const sharedRoot = resolve(ROOT, "../saas-identity-platform-shared");
  const labNextjsRoot = resolve(sharedRoot, "../lab-management-system-nextjs");
  const requireFromLab = createRequire(resolve(labNextjsRoot, "package.json"));
  pgModule = requireFromLab("pg") as { Client: new (cfg: unknown) => PgClient };
} catch {
  // 借不到就 skip
}

const DATABASE_URL = process.env.DATABASE_URL;

describe("DB smoke", () => {
  if (!pgModule || !DATABASE_URL) {
    it.skip("pg or DATABASE_URL unavailable", () => {});
    return;
  }

  let client: PgClient | null = null;

  beforeAll(async () => {
    client = new pgModule.Client({
      connectionString: DATABASE_URL,
      connectionTimeoutMillis: 5000,
    });
    await client.connect();

    // 跑 shared/migrations（按文件名字典序）
    const migrationsDir = resolve(ROOT, "migrations");
    const files = readdirSync(migrationsDir)
      .filter((f) => /^V\d+__.*\.sql$/.test(f))
      .sort();

    // 如果 migrations/ 还没复制，从 shared 复制一份
    if (files.length === 0) {
      console.log("[db.smoke] migrations/ empty; copying from shared");
      const sharedSql = resolve(ROOT, "../saas-identity-platform-shared/sql/migrations");
      try {
        execSync(`mkdir -p "${migrationsDir}" && cp "${sharedSql}"/V*.sql "${migrationsDir}"/`, {
          stdio: "ignore",
        });
      } catch {
        // 复制失败则 skip
        return;
      }
    }

    for (const f of readdirSync(migrationsDir).filter((f) => /^V\d+__.*\.sql$/.test(f)).sort()) {
      const sql = readFileSync(resolve(migrationsDir, f), "utf-8");
      await client.query(sql);
    }
  });

  it("connects and selects 1", async () => {
    if (!client) return;
    const { rows } = await client.query("SELECT 1 AS ok");
    expect(rows[0]?.ok).toBe(1);
  });

  it("has 12 tables after migrations", async () => {
    if (!client) return;
    const { rows } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    expect(rows.length).toBeGreaterThanOrEqual(12);
  });
});