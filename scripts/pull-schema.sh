#!/usr/bin/env bash
# scripts/pull-schema.sh — drizzle-kit pull 从真库反推 src/db/schema.ts（DB-First, ADR-0025）
#
# 设计：
# - 共享 shared 仓是真源（schema-first）；shared 跑 db:migrate 应用到 DB
# - nextjs 跑 drizzle-kit pull 把 DB 结构反推为 src/db/schema.ts
# - drizzle-kit pull 默认输出到 drizzle/schema.ts（不在 src/db/）；本脚本 move + cleanup
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
PULL_OUT_DIR="drizzle"

echo "[pull-schema] step 1/4 — drizzle-kit pull → ${PULL_OUT_DIR}/schema.ts"
PG_HOST="${PG_HOST:-100.79.128.25}"
PG_PORT="${PG_PORT:-5432}"
PG_USER="${PG_USER:-postgres}"
PG_PASSWORD="${PG_PASSWORD:-}"
PG_DATABASE="${PG_DATABASE:-saas_dev}"
export PG_HOST PG_PORT PG_USER PG_PASSWORD PG_DATABASE

if [ -z "$PG_PASSWORD" ]; then
  echo "[pull-schema] FATAL: PG_PASSWORD 未设" >&2
  exit 1
fi

# 清理上一次的 drizzle/ 产物（pull 会写到 drizzle/）
rm -rf "$PULL_OUT_DIR"

npx --no drizzle-kit pull --config drizzle.config.ts

if [ ! -f "${PULL_OUT_DIR}/schema.ts" ]; then
  echo "[pull-schema] FATAL: ${PULL_OUT_DIR}/schema.ts 未生成" >&2
  exit 1
fi

echo "[pull-schema] step 2/4 — move ${PULL_OUT_DIR}/schema.ts → ${SCHEMA_FILE}"
mkdir -p "$(dirname "$SCHEMA_FILE")"
mv "${PULL_OUT_DIR}/schema.ts" "${SCHEMA_FILE}"

echo "[pull-schema] step 3/4 — cleanup ${PULL_OUT_DIR}/ + relations.ts"
# relations.ts 是 drizzle-kit 自动生成的辅助文件；本仓不需要
rm -rf "$PULL_OUT_DIR"

echo "[pull-schema] step 4/4 — drift detection: git diff ${SCHEMA_FILE}"
if ! git diff --exit-code --quiet "${SCHEMA_FILE}" 2>/dev/null; then
  echo "[pull-schema] FATAL: ${SCHEMA_FILE} 与 git HEAD 不一致" >&2
  echo "[pull-schema]        漂移来源：" >&2
  git diff --stat "${SCHEMA_FILE}" >&2
  echo "[pull-schema]        处理：确认 DB 是最新（shared 已 db:migrate），然后 git add ${SCHEMA_FILE} && git commit" >&2
  exit 1
fi

echo "[pull-schema] OK"
echo "[pull-schema]    ${SCHEMA_FILE} 与 git HEAD 一致；DB-First sync 绿"

# ADR-0026 §2: 写 last-gen-shared.json marker（DB 类别），失败不阻塞 pull-schema。
SHARED_DIR="$(cd "$(git rev-parse --show-toplevel)/../saas-identity-platform-shared" && pwd)"
SHARED_SHA=$(cd "$SHARED_DIR" && git rev-parse HEAD)
MARKER="$(git rev-parse --show-toplevel)/.state/last-gen-shared.json"
mkdir -p "$(dirname "$MARKER")"

if python3 - "$MARKER" "$SHARED_SHA" "$(basename "$0")" "saas-identity-platform-nextjs" <<'PYEOF'
import datetime, json, sys

marker_path, shared_sha, cmd, repo = sys.argv[1:5]
try:
    with open(marker_path, encoding="utf-8") as f:
        marker = json.load(f)
except (FileNotFoundError, json.JSONDecodeError):
    marker = {}

now = datetime.datetime.now(datetime.timezone.utc).isoformat()
if cmd.startswith("gen-shared"):
    marker["api_synced_sha"] = shared_sha
    marker["api_synced_at"] = now
    marker["api_synced_cmd"] = cmd
elif cmd.startswith("pull-schema") or cmd.startswith("scaffold"):
    marker["db_synced_sha"] = shared_sha
    marker["db_synced_at"] = now
    marker["db_synced_cmd"] = cmd

shas = [s for s in (marker.get("api_synced_sha"), marker.get("db_synced_sha")) if s]
marker["shared_sha"] = max(shas) if shas else shared_sha
marker["consumer_repo"] = repo

with open(marker_path, "w", encoding="utf-8") as f:
    json.dump(marker, f, ensure_ascii=False, indent=2)
    f.write("\n")
PYEOF
then
  echo "[pull-schema]    ADR-0026 marker 已落盘: $MARKER (shared HEAD ${SHARED_SHA:0:7})"
else
  echo "[pull-schema]    WARN: marker 写失败（python3 缺失？）—— staleness 将报 UNKNOWN" >&2
fi
