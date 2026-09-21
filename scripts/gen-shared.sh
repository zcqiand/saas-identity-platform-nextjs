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
# 5.86: orval 原始产物非 prettier 形态（L1 门按 prettier 收）——内建格式化令 regen 严格 byte-idempotent（5.23 spotless 先例）
echo "[gen-shared] step 2b — prettier --write src/api/endpoints"
npx --no -- prettier --write "src/api/endpoints/**/*.ts"


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

# 5.77（2026-09-21 人裁立项）：同 sha 零写入——目标通道 synced_sha 与现存 marker 相同
# → 整个 marker 文件零写入（时间戳/mtime 保持原值，字节级幂等）；sha 真变才全量写
# （新 sha + 新时间戳）。判据只比 sha，时间戳不参与；JSON 形状/key 名一概不动。
if cmd.startswith("gen-shared"):
    channel = "api_synced"
elif cmd.startswith(("scaffold", "sync-db", "pull-schema")):
    channel = "db_synced"
else:
    channel = None

if channel is not None and marker.get(channel + "_sha") == shared_sha:
    print("[marker] %s_sha unchanged (%s...) - zero write, keep timestamp (5.77)"
          % (channel, shared_sha[:12]))
    sys.exit(3)

now = datetime.datetime.now(datetime.timezone.utc).isoformat()
if channel is not None:
    marker[channel + "_sha"] = shared_sha
    marker[channel + "_at"] = now
    marker[channel + "_cmd"] = cmd

# shared_sha 取「最近一次同步」对应的 sha：ISO-8601 UTC 时间戳字典序==时间序。
# 勿用 max(sha)——SHA 字典序不是 git 时间序（5.21 事故）。
entries = [
    (marker.get(k + "_at", ""), marker[k + "_sha"])
    for k in ("api_synced", "db_synced")
    if marker.get(k + "_sha")
]
marker["shared_sha"] = max(entries)[1] if entries else shared_sha
marker["consumer_repo"] = repo

with open(marker_path, "w", encoding="utf-8") as f:
    json.dump(marker, f, ensure_ascii=False, indent=2)
    f.write("\n")
PYEOF
then
    echo "[gen-shared]    ADR-0026 marker 已落盘: $MARKER (shared HEAD ${SHARED_SHA:0:7})"
  else
    rc=$?
    if [ "$rc" -eq 3 ]; then
      echo "[gen-shared]    ADR-0026 marker sha 未变，零写入（5.77 同 sha 不刷时间戳）: $MARKER"
    else
      echo "[gen-shared]    WARN: marker 写失败（python3 缺失？）—— staleness 将报 UNKNOWN" >&2
    fi
  fi
else
  echo "[gen-shared]    WARN: 非 git 仓（Docker builder？）—— 跳过 ADR-0026 marker 写" >&2
fi