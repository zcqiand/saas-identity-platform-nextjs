// DB client — postgres-js + drizzle-orm
//
// 「server-only」原则：
// - 本模块只能被 Route Handler / Server Action / Server Component 引入
// - 禁止 client component import；webpack 会在 build 时报 'server-only' 错误
// - 详见 profiles/nextjs-backend.toml §[stack_rules].forbid
//
// ADR-0032 候选②（2026-09-19 落地）：DATABASE_URL 惰性求值。
// - 旧版模块顶层裸 throw：next build「collect page data」阶段 import 路由模块
//   即崩（无 DATABASE_URL 的构建环境必炸，见 memory
//   nextjs-module-scope-requireenv-breaks-docker-build）。
// - 现改为惰性单例：import 零副作用，首次访问 db 才解析/连接；
//   缺失时仍在首次使用处 throw（fail-fast 不兜底，ADR-0019 / ADR-0009）。

import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// 注意：createDb 不写返回类型标注——Db 由 ReturnType 推导，
// 若 createDb 反向标注 : Db 会构成循环类型别名（解析为 any，链式推断全丢）。
function createDb() {
  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is not set. See docs/conventions/nextjs-full-stack.md §凭据 (ADR-0009).",
    );
  }

  // postgres-js client（连接池；Next.js Route Handler 是短生命周期，每次请求 pool 取一个）
  const client = postgres(DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  // drizzle ORM 入口；schema 来自 drizzle-kit pull（ADR-0025 DB-First）
  return drizzle(client, { schema });
}

type Db = ReturnType<typeof createDb>;

let instance: Db | null = null;

// 惰性单例 Proxy：保持 `import { db }` 形态不变（28 处消费点零改动）。
// drizzle 句柄是方法集合对象（select/insert/update/delete/transaction/query…），
// 方法必须绑定真实实例调用，故 get trap 里 bind；trap 按 Db[K] 保型，
// 消费点链式调用的类型推断（select().from() 回调参数等）不受影响。
export const db: Db = new Proxy({} as Db, {
  get<K extends keyof Db>(_target: Db, prop: K): Db[K] {
    instance ??= createDb();
    const value = instance[prop];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(instance) as Db[K];
    }
    return value;
  },
});

export type Database = Db;
export { schema };
