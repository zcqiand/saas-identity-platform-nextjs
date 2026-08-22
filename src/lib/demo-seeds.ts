// demo 模式 seed JSON 加载器（/api/v1/apps/[code] 与 /api/v1/me/menus 共用）。
//
// ADR-0012 运行时 import 清零的一部分：不再 JS import @saas/identity-platform-msw，
// 改为 fs 读 seed JSON。查找顺序：
//   1. <cwd>/seeds         -- Docker 构建期从 saas-msw clone 拷入（standalone
//                              runtime 只有这个；sibling clone 不进 runtime 层）
//   2. <cwd>/../saas-identity-platform-msw/src/seeds -- 本地 dev（sibling 仓存在）
// Phase 6 接 DB 后本文件连同两个调用方一起删（换 drizzle 查询）。

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const CANDIDATE_DIRS = [
  resolve(process.cwd(), "seeds"),
  resolve(process.cwd(), "../saas-identity-platform-msw/src/seeds"),
];

/** 按候选顺序读一个 seed JSON；全部 miss 时 throw（调用方转 500）。 */
export function loadSeedJson<T>(name: string): T {
  for (const dir of CANDIDATE_DIRS) {
    try {
      return JSON.parse(readFileSync(resolve(dir, name), "utf8")) as T;
    } catch {
      // 试下一个候选目录
    }
  }
  throw new Error(
    `seed '${name}' not found in any of: ${CANDIDATE_DIRS.join(", ")}`,
  );
}
