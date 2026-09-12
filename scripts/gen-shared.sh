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

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"
SHARED_DIR="$(cd .. && pwd -P)/saas-identity-platform-shared"

echo "[gen-shared] step 1/2 — shared: emit OpenAPI.yaml..."
(cd "$SHARED_DIR" && npm run emit:openapi)

echo "[gen-shared] step 2/2 — nextjs: orval → src/api/endpoints/..."
npx orval

echo "[gen-shared] OK"
echo "[gen-shared]    DB schema 同步请跑: bash scripts/pull-schema.sh"

# ADR-0026 §2: 写 last-gen-shared.json marker（API 类别），失败不阻塞 gen-shared。
# set -e 在 marker 块之前的任何 step 失败已 exit；此处仅在 emit + orval 全绿后到达。
# 2026-09-13 修复：Docker builder 无 .git（sibling 仓 clone 在 /app 之外），
# `git rev-parse --show-toplevel` 在 set -e 下 exit 128 炸掉 npm run build（prebuild），
# v0.7.61 起首个 tag 部署即炸。非 git 仓环境跳过 marker 写，仅 WARN（本块原意即不阻塞）。
if MARKER_ROOT="$(git rev-parse --show-toplevel 2>/dev/null)"; then
  SHARED_SHA=$(cd "$SHARED_DIR" && git rev-parse HEAD)
  MARKER="$MARKER_ROOT/.state/last-gen-shared.json"
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
    echo "[gen-shared]    ADR-0026 marker 已落盘: $MARKER (shared HEAD ${SHARED_SHA:0:7})"
  else
    echo "[gen-shared]    WARN: marker 写失败（python3 缺失？）—— staleness 将报 UNKNOWN" >&2
  fi
else
  echo "[gen-shared]    WARN: 非 git 仓（Docker builder？）—— 跳过 ADR-0026 marker 写" >&2
fi