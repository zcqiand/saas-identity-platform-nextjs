// DB smoke test：PG 连接 + 验证 shared 迁移已就位 + select 1。
//
// ADR-0025（shared 26a7281 删 sql/migrations）后 nextjs 不拥有迁移：
// schema SSOT 在 shared 的 drizzle/ journal，由 shared `db:migrate` 应用到真库；
// nextjs 走 DB-First（drizzle-kit pull，scripts/pull-schema.sh）。
// 本测试只冒烟「连得上 + 库已被 shared 迁移过」，不执行任何 SQL 文件。
//
// 跳过条件：DATABASE_URL 未设 / `npm install` 没装 pg 时。CI 实跑。
// SSR 环境（Next.js server-only）：src/db/index.ts 顶部有 `import "server-only"`，
// 所以测试必须放到 vitest node 环境，且不走 Next bundler。

import { describe, it, expect, beforeAll } from "vitest";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// 借 pg 来自 sibling（nextjs 仓不直接 dep pg；通过 postgres-js 间接）
// 测试中直接用 pg.Client 是简化路径，避 postgres-js 实例化对环境的隐式依赖
type PgClient = {
  connect(): Promise<void>;
  query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }>;
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
  });

  it("connects and selects 1", async () => {
    if (!client) return;
    const { rows } = await client.query("SELECT 1 AS ok");
    expect(rows[0]?.ok).toBe(1);
  });

  it("has 12 tables after shared migrations", async () => {
    if (!client) return;
    const { rows } = await client.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name",
    );
    expect(rows.length).toBeGreaterThanOrEqual(12);
  });
});
