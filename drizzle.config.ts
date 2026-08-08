import { defineConfig } from "drizzle-kit";

/** PostgreSQL drizzle-kit 配置。url 由 env 注入。 */
export default defineConfig({
  schema: "./src/db/generated/db.pg.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgresql://postgres:qiand68%2B%2B%2B@100.79.128.25:5432/saas_dev",
  },
  verbose: true,
  strict: true,
});
