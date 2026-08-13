#!/usr/bin/env bash
# scripts/gen-shared.sh — 双 SSOT 同步：
#   1. API 层：shared/tsp → shared/openapi.yaml → 本仓 src/api/endpoints/（orval）
#   2. DB 层：shared/sql/migrations/*.sql → 本仓 migrations/ + node-pg-migrate up
#
# 用法（在 nextjs 仓根）：
#   bash scripts/gen-shared.sh
#
# 环境：DATABASE_URL（与 src/db/index.ts 一致）。无 DATABASE_URL 时 DB 步骤跳过。
# ADR-0007（shared/sql/ 是 SSOT）+ ADR-0008（nextjs 是 full-stack）。

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
SHARED_DIR="$(cd .. && pwd -P)/saas-identity-platform-shared"

echo "[gen-shared] step 1/3 — shared: emit OpenAPI.yaml..."
(cd "$SHARED_DIR" && npm run emit:openapi)

echo "[gen-shared] step 2/3 — nextjs: orval → src/api/endpoints/..."
npx orval

echo "[gen-shared] step 3/3 — DB: copy shared/sql/migrations/* → migrations/ + node-pg-migrate up"
MIGRATIONS_SRC="$SHARED_DIR/sql/migrations"
MIGRATIONS_DST="$(pwd)/migrations"

if [ ! -d "$MIGRATIONS_SRC" ]; then
  echo "[gen-shared] WARN: $MIGRATIONS_SRC not found; DB skipped (did Phase 1 land?)"
  exit 0
fi

mkdir -p "$MIGRATIONS_DST"

# 复制 V*.sql（SSOT；不允许修改）
for f in "$MIGRATIONS_SRC"/V*.sql; do
  [ -e "$f" ] || continue
  cp "$f" "$MIGRATIONS_DST/"
done

# 复制 README（供本仓开发者读）
[ -f "$SHARED_DIR/sql/README.md" ] && cp "$SHARED_DIR/sql/README.md" "$MIGRATIONS_DST/README.md"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[gen-shared] WARN: DATABASE_URL not set; skipping node-pg-migrate up"
  echo "[gen-shared] OK (API only)"
  exit 0
fi

DATABASE_URL="$DATABASE_URL" npx node-pg-migrate up --migrations-dir "$MIGRATIONS_DST" --tsconfig ./tsconfig.json

echo "[gen-shared] OK"