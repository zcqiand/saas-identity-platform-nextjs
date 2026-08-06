/**
 * vitest globalSetup —— 在所有 worker 启动前 / 所有 worker 退出后各跑一次。
 *
 * 职责：
 *   - setup(): 启动前清扫陈旧 `test_*` schema（来自上次崩溃或外部脏状态的残留），
 *     保证本次跑开始时 saas_test 干净，worker 进程们再各自建自己的 schema。
 *   - teardown(): 全部测试结束后再扫一遍 `test_*` schema 全部 DROP，回收本次跑
 *     中 worker 们建的 schema（tests/setup-db.ts 的 afterAll 故意不删，统一交给这里）。
 *
 * 这样即便某个 worker 进程崩溃没跑到 afterAll，teardown 也会兜底回收。
 */
import { Pool } from "pg";

async function sweepTestSchemas(pool: Pool): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT nspname FROM pg_namespace WHERE nspname LIKE 'test\\_%' ESCAPE '\\' ORDER BY nspname`
  );
  const dropped: string[] = [];
  for (const row of rows) {
    const name = row.nspname as string;
    // 防御性校验：只 DROP 形如 test_xxx 的 schema 名（数字/字母/下划线）。
    if (!/^test_[a-z0-9_]+$/i.test(name)) continue;
    await pool.query(`DROP SCHEMA IF EXISTS "${name}" CASCADE`);
    dropped.push(name);
  }
  return dropped;
}

export async function setup(): Promise<() => Promise<void>> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL must point at *_test db in vitest (.env.test)");
  }
  const pool = new Pool({ connectionString: url });

  // 启动前同步清扫：await 保证 worker 启动时已干净。
  try {
    const pre = await sweepTestSchemas(pool);
    if (pre.length > 0) {
      console.log(`[global-setup] pre-sweep dropped ${pre.length} stale schema(s): ${pre.join(", ")}`);
    }
  } catch (e) {
    // 不阻断启动：worker 各自 CREATE SCHEMA IF NOT EXISTS 幂等。
    console.error("[global-setup] pre-sweep failed:", e);
  }

  return async function teardown(): Promise<void> {
    try {
      const dropped = await sweepTestSchemas(pool);
      if (dropped.length > 0) {
        console.log(
          `[global-setup] teardown dropped ${dropped.length} test schema(s): ${dropped.join(", ")}`
        );
      }
    } catch (e) {
      console.error("[global-setup] teardown sweep failed:", e);
    } finally {
      await pool.end();
    }
  };
}

export default setup;
