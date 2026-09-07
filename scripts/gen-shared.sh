#!/usr/bin/env bash
# scripts/gen-shared.sh — shared 仓 API 契约同步（ADR-0025）
#
# 设计：
# - API 层：shared/tsp → shared/openapi.yaml → 本仓 src/api/endpoints/（orval）
# - DB 层：nextjs 走 DB-First（drizzle-kit pull，见 scripts/pull-schema.sh）；
#   共享 shared 仓已通过 drizzle-kit migrate 把 schema 应用到 DB。
#
# 用法（在 nextjs 仓根）：
#   bash scripts/gen-shared.sh
#
# ADR-0008（nextjs 是 full-stack）+ ADR-0025（schema-first）。

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
SHARED_DIR="$(cd .. && pwd -P)/saas-identity-platform-shared"

echo "[gen-shared] step 1/2 — shared: emit OpenAPI.yaml..."
(cd "$SHARED_DIR" && npm run emit:openapi)

echo "[gen-shared] step 2/2 — nextjs: orval → src/api/endpoints/..."
npx orval

echo "[gen-shared] OK"
echo "[gen-shared]    DB schema 同步请跑: bash scripts/pull-schema.sh"