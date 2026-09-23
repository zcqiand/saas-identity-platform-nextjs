#!/bin/sh
# 容器入口:迁移 →(仅首次)seed → next start
#
# 数据库:PostgreSQL(远程)。DATABASE_URL 由 `--env-file saas.env` 注入,
# 缺则 fail fast —— 不要回退到 dev 默认 URL,prod 不允许。
#
# - drizzle-kit migrate 幂等,从 shared/drizzle/ 增量 apply,journal 落
#   public.__drizzle_migrations(ADR-0025 收尾,2026-09-13;旧 sync-db/Flyway 链已删)。
#   可重跑,已 apply 的迁移不会重复执行。
# - scripts/seed-db.mjs 默认 TRUNCATE 后灌,会**重置**种子数据。
#   仅在 __drizzle_migrations 还没有行(全新库)时执行,避免每次重启覆盖生产改动。
#
# standalone:next start 跑 server.js(已 COPY 进来)。
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "ERROR: DATABASE_URL is required (VPS saas.env)" >&2
  exit 1
fi

# drizzle-kit config 强制读 PG_* 五件套（即便 DATABASE_URL 已设 —— 它不解析 URL）
# 镜像 lab-management-system-nextjs/deploy/docker-entrypoint.sh 同款修法。
# 家族策略（memory springboot-gate-scaffold-needs-pg-url）= 派生层把单源 DATABASE_URL
# 裂成 PG_* 给下游 drizzle-kit；已显式注入的 PG_* 保留（CI/dev 不覆盖）。
case "${DATABASE_URL:-}" in
  postgresql://*|postgres://*)
    proto="${DATABASE_URL%%://*}"
    rest="${DATABASE_URL#*://}"
    userpass="${rest%%@*}"
    hostpath="${rest#*@}"
    hostport="${hostpath%%/*}"
    database="${hostpath#*/}"
    database="${database%%\?*}"
    derived_user="${userpass%%:*}"
    derived_password="${userpass#*:}"
    derived_host="${hostport%%:*}"
    derived_port="${hostport#*:}"
    [ -z "${PG_HOST:-}" ]       && PG_HOST="$derived_host"
    [ -z "${PG_PORT:-}" ]       && PG_PORT="${derived_port:-5432}"
    [ -z "${PG_USER:-}" ]       && PG_USER="$derived_user"
    [ -z "${PG_PASSWORD:-}" ]   && PG_PASSWORD="$derived_password"
    [ -z "${PG_DATABASE:-}" ]   && PG_DATABASE="$database"
    export PG_HOST PG_PORT PG_USER PG_PASSWORD PG_DATABASE
    ;;
  *)
    echo "ERROR: unsupported DATABASE_URL scheme (expect postgresql://)" >&2
    exit 1
    ;;
esac

# 探测是否首启:migrations 表是否空。空 → FIRST=1;非空 → 跳过 seed
FIRST=0
ROW_COUNT=$(node -e "
  import('pg').then(({Client}) => {
    const c = new Client({connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 5000});
    c.connect().then(() => c.query('SELECT COUNT(*)::int AS n FROM pg_tables WHERE tablename = \$1', ['__drizzle_migrations']))
      .then(r => {
        if (r.rows[0].n === 0) { console.log('0'); process.exit(0); }
        return c.query('SELECT COUNT(*)::int AS n FROM __drizzle_migrations');
      })
      .then(r => { console.log(String(r.rows[0].n)); process.exit(0); })
      .catch(e => { console.error('probe failed:', e.message); process.exit(1); })
      .finally(() => c.end());
  });
" 2>/dev/null || echo "0")

if [ "${ROW_COUNT}" = "0" ]; then
  FIRST=1
fi

echo "→ drizzle-kit migrate (apply shared/drizzle/*.sql, journal public.__drizzle_migrations)"
npx --no drizzle-kit migrate --config drizzle.runtime.config.ts

if [ "$FIRST" = 1 ]; then
  echo "→ first run: seeding demo data from MSW seeds/*.json"
  node scripts/seed-db.mjs
else
  echo "→ not first run, skipping seed (rows in __drizzle_migrations: ${ROW_COUNT})"
fi

echo "→ next start -p ${PORT:-5101}"
exec node server.js -p "${PORT:-5101}"
