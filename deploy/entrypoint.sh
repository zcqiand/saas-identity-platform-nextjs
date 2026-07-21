#!/bin/sh
# =============================================================================
# deploy/entrypoint.sh — 容器启动脚本
#
# 启动顺序：
#   1. 后台拉起 node server.js（Next.js standalone，PORT=3000）
#   2. 等它 ready（wget /loopback:3000/，最多 30s）
#   3. 前台启 nginx（容器主进程），保活
#
# 信号：trap SIGTERM/SIGINT → 先停 nginx，再停 node，干净退出。
# =============================================================================

set -e

# ---- 准备 data/ 目录 ----
# 镜像里 /app/data 是空的；prod 用 -v /srv/saas-identity-platform-nextjs/data:/app/data
# 把宿主机上的 dev.db（或初始化后的 prod.db）挂进来。
if [ ! -d /app/data ]; then
    mkdir -p /app/data
    # node:node 是 node:20-alpine 镜像自带的用户（UID/GID 1000），不是 nextjs
    chown -R node:node /app/data 2>/dev/null || true
fi

# 把 node_modules/better-sqlite3 的权限修正（COPY 时是 node:node，
# runtime USER root 启动进程，child_process 子进程要能 dlopen .node 文件）。
chmod -R a+rX /app/node_modules/better-sqlite3 2>/dev/null || true

# ---- 启动 Next.js standalone server（后台） ----
# standalone/server.js 是 Next 生成的入口。PORT=3000 由 Dockerfile ENV 注入。
cd /app
echo "[entrypoint] starting next server on :3000..."
node server.js > /var/log/next.log 2>&1 &
NEXT_PID=$!
echo "[entrypoint] next pid=$NEXT_PID"

# ---- 等 next ready ----
# 拉 / 看返回码，30s timeout。
i=0
while [ $i -lt 30 ]; do
    if wget -qO- http://127.0.0.1:3000/ > /dev/null 2>&1; then
        echo "[entrypoint] next server ready after ${i}s"
        break
    fi
    # 进程死了直接 fail
    if ! kill -0 $NEXT_PID 2>/dev/null; then
        echo "[entrypoint] next server died early:"
        cat /var/log/next.log
        exit 1
    fi
    i=$((i+1))
    sleep 1
done

if [ $i -ge 30 ]; then
    echo "[entrypoint] next server failed to become ready in 30s:"
    cat /var/log/next.log
    exit 1
fi

# ---- trap signals，干净停 ----
shutdown() {
    echo "[entrypoint] received shutdown signal"
    # nginx 先停（卸 80 端口）
    if [ -f /tmp/nginx.pid ]; then
        kill -QUIT "$(cat /tmp/nginx.pid)" 2>/dev/null || true
    fi
    # next 再停
    kill -TERM $NEXT_PID 2>/dev/null || true
    wait $NEXT_PID 2>/dev/null || true
    exit 0
}
trap shutdown SIGTERM SIGINT

# ---- 启动 nginx（前台，保活） ----
echo "[entrypoint] starting nginx on :80"
nginx -g "daemon off;" &
NGINX_PID=$!
wait $NGINX_PID