// drizzle.config.ts — saas-identity-platform-nextjs DB-First config（ADR-0025 Phase 2）
//
// 设计：
// - nextjs 是消费方，不调 drizzle-kit generate（schema SSOT 在 shared 仓）
// - 仅用 drizzle-kit pull 从真库 introspect 生成 src/db/schema.ts
// - pull 输出入 git；CI drift 检测（pull-schema.sh）守 schema 与 DB 一致
//
// 与 shared 仓 drizzle.config.ts 区别：
// - shared: schema = ./src/db/schema.ts（手写 SSOT），out = ./drizzle（generate 产物）
// - nextjs: schema 不指定（pull 模式），introspect 输出到 src/db/schema.ts

import { defineConfig } from "drizzle-kit";

const pgHost = process.env.PG_HOST ?? "100.79.128.25";
const pgPort = Number(process.env.PG_PORT ?? 5432);
const pgUser = process.env.PG_USER ?? "postgres";
const pgPassword = process.env.PG_PASSWORD ?? "";
const pgDatabase = process.env.PG_DATABASE ?? "saas_dev";
const pgSsl = process.env.PG_SSL === "1";

export default defineConfig({
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: {
    host: pgHost,
    port: pgPort,
    user: pgUser,
    password: pgPassword,
    database: pgDatabase,
    ssl: pgSsl,
  },
  verbose: true,
  strict: true,
});
