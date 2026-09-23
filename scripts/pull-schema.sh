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

# 5.98：错库 pull 实证（eea5fae 把 saas_test 序提交进 HEAD）——目标库响亮回显。
if [ "${PG_DATABASE}" != "saas_dev" ]; then
  echo "[pull-schema] WARN: 目标库=${PG_DATABASE}（非 saas_dev；镜像真源是 saas_dev）" >&2
fi
echo "[pull-schema] target DB: ${PG_DATABASE}@${PG_HOST}"

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
# 5.86: drizzle-kit 原始输出非 prettier 形态（5.73 起 schema.ts 受 L1 门）——内建格式化消 drift 门假红，regen 严格 byte-idempotent
echo "[pull-schema] prettier --write ${SCHEMA_FILE}"
npx --no -- prettier --write "${SCHEMA_FILE}"

# 5.91（终审后续 drift 假红根治）：drizzle-kit introspection 的索引列 `.op("<x>_ops")`
# 标注不可靠——两库 schema 逐字节一致（13 表同名集 + indclass 数组/indexdef 全等，
# 2026-09-21 实证）却因 OID 布局等库元数据差异产出不同 opclass 标注（uuid_ops/
# text_ops/int2_ops 错位挂到 varchar 列）。schema.ts 是 DB-First 镜像产物（仅作
# drift 比对，不参与 db:push），`.op()` 后缀剥离后输出与库无关、确定性成立。
sed -i -E 's/\.op\("[a-z0-9]+_ops"\)//g' "${SCHEMA_FILE}"
# 5.98（drift 假红同族根治）：drizzle-kit pull 的表块顺序随库目录布局漂移——同库内
# 逐次确定，跨库/重建后翻面（saas_dev 与 saas_test 两种序、内容 multiset 全等；当日
# eea5fae 即错库 pull 把 saas_test 序提交进 HEAD 的实证）。schema.ts 仅作 drift 比对
# 块序无语义，按导出标识符字典序 canonical 化，使镜像与「哪个库、何时重建」无关；
# 错库 pull 不再产生伪漂移，真实 DDL diff 仍照常暴露。
echo "[pull-schema] canonicalize table block order (5.98)"
python3 scripts/canonicalize-schema.py "${SCHEMA_FILE}" "${SCHEMA_FILE}"
npx --no -- prettier --write "${SCHEMA_FILE}"


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
  echo "[pull-schema]    ADR-0026 marker 已落盘: $MARKER (shared HEAD ${SHARED_SHA:0:7})"
else
  rc=$?
  if [ "$rc" -eq 3 ]; then
    echo "[pull-schema]    ADR-0026 marker sha 未变，零写入（5.77 同 sha 不刷时间戳）: $MARKER"
  else
    echo "[pull-schema]    WARN: marker 写失败（python3 缺失？）—— staleness 将报 UNKNOWN" >&2
  fi
fi
