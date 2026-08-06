/** 运行期迁移入口：tsx src/db/migrate.ts。把 ./drizzle 应用到 DATABASE_URL。 */
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { resolve } from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool);
  console.log("migrating…");
  await migrate(db, { migrationsFolder: resolve(process.cwd(), "drizzle") });
  console.log("migrated");
  await pool.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
