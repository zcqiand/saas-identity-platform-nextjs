import { defineConfig } from "drizzle-kit";

/**
 * drizzle-kit 配置。`dbCredentials.url` 指向本地 dev.db；CI/生产换 env 即可。
 * out 目录约定是 ./drizzle，由 .gitignore 屏蔽（不要手写迁移）。
 */
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: process.env.DB_PATH ?? "data/dev.db",
  },
  verbose: true,
  strict: true,
});
