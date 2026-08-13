// DB client — postgres-js + drizzle-orm
//
// 「server-only」原则：
// - 本模块只能被 Route Handler / Server Action / Server Component 引入
// - 禁止 client component import；webpack 会在 build 时报 'server-only' 错误
// - 详见 profiles/nextjs-backend.toml §[stack_rules].forbid

import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

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

// drizzle ORM 入口；schema 镜像 shared/sql/migrations/*
export const db = drizzle(client, { schema });

export type Database = typeof db;
export { schema };