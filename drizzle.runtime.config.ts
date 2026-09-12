// drizzle.runtime.config.ts — 容器 runtime 迁移配置（ADR-0025 收尾，2026-09-13）
//
// 背景：shared 仓 26a7281（ADR-0025 Phase 1.3）删除 sql/ + sync-db.mjs 旧 Flyway 链后，
// 迁移唯一真相 = shared 仓 drizzle/ 目录（journal: public.__drizzle_migrations）。
// Dockerfile 把 shared/drizzle COPY 进镜像，entrypoint 用本配置跑 drizzle-kit migrate。
//
// 与 shared 仓 drizzle.config.ts 的差异：
// - migrations 块逐字相同（table/schema/prefix 必须一致，journal hash 才能对上）
// - out 从 env DRIZZLE_MIGRATIONS_DIR 读（Dockerfile 指向 COPY 进来的 sibling drizzle/）
// - 不需要 schema 字段（migrate 只消费 out 下的 journal + sql）
//
// 禁 env 默认值兜底（CLAUDE.md §2 / ADR-0019）：PG_* 缺失直接 throw，prod 由 saas.env 注入。

import { defineConfig } from "drizzle-kit";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} env required`);
  return value;
}

export default defineConfig({
  dialect: "postgresql",
  out: requireEnv("DRIZZLE_MIGRATIONS_DIR"),
  schemaFilter: ["public"],
  migrations: {
    table: "__drizzle_migrations",
    schema: "public",
    prefix: "index",
  },
  dbCredentials: {
    host: requireEnv("PG_HOST"),
    port: Number(requireEnv("PG_PORT")),
    user: requireEnv("PG_USER"),
    password: requireEnv("PG_PASSWORD"),
    database: requireEnv("PG_DATABASE"),
    ssl: process.env.PG_SSL === "1",
  },
  verbose: true,
  strict: true,
});
