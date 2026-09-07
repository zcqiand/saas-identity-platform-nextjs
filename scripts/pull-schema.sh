#!/usr/bin/env bash
# scripts/pull-schema.sh — drizzle-kit pull 从真库反推 src/db/schema.ts（DB-First, ADR-0025）
#
# 设计：
# - 共享 shared 仓是真源（schema-first）；shared 跑 db:migrate 应用到 DB
# - nextjs 跑 drizzle-kit pull 把 DB 结构反推为 src/db/schema.ts
# - 生成的 schema.ts 入 git；CI 检测 drift（与 git HEAD 对比）
# - 漂移即 exit 1，强制 schema.ts 必须显式 commit（防止本地与 CI 不一致）
#
# 用法：
#   bash scripts/pull-schema.sh                       # pull from saas_dev
#   PG_DATABASE=saas_test bash scripts/pull-schema.sh
#
# 退出码：
#   0 — pulled OK + 与 git HEAD 一致
#   1 — pull 失败 或 与 git HEAD 有 diff（需手动 commit）

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

SCHEMA_FILE="src/db/schema.ts"

echo "[pull-schema] step 1/3 — drizzle-kit pull → ${SCHEMA_FILE}"
npx --no drizzle-kit pull --config drizzle.config.ts \
    --schema="${SCHEMA_FILE%.ts}"

if [ ! -f "${SCHEMA_FILE}" ]; then
  echo "[pull-schema] FATAL: ${SCHEMA_FILE} 未生成" >&2
  exit 1
fi

echo "[pull-schema] step 2/3 — drift detection: git diff ${SCHEMA_FILE}"
if ! git diff --exit-code --quiet "${SCHEMA_FILE}"; then
  echo "[pull-schema] FATAL: ${SCHEMA_FILE} 与 git HEAD 不一致" >&2
  echo "[pull-schema]        漂移来源：" >&2
  git diff --stat "${SCHEMA_FILE}" >&2
  echo "[pull-schema]        处理：确认 DB 是最新（shared 已 db:migrate），然后 git add ${SCHEMA_FILE} && git commit" >&2
  exit 1
fi

echo "[pull-schema] step 3/3 — OK"
echo "[pull-schema]    ${SCHEMA_FILE} 与 git HEAD 一致；DB-First sync 绿"
