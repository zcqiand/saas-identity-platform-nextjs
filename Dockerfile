# =============================================================================
# saas-identity-platform-nextjs — 多阶段构建
#
#   deps      → 安装所有依赖（含 better-sqlite3 的 native build 工具链）
#   builder   → next build，产出 .next/standalone + .next/static
#   runtime   → 运行时只装 node + nginx；.next/standalone + better-sqlite3 binary
#               + 静态资源 + nginx 配置
#
# 参考：output/saas-identity-platform/DEPLOYMENT.md §2（容器内 nginx + 反代结构）
#       + Next.js standalone 官方推荐：https://nextjs.org/docs/app/api-reference/next-config-js/output
#
# 端口：
#   容器内：node server listen 3000（standalone server.js 默认 PORT=3000）
#           nginx listen 80（容器网关）
#   宿主机：docker run -p 127.0.0.1:8065:80（VPS nginx 反代的上游端口）
# =============================================================================


# ---------- Stage 1: deps ----------
# 锁住整个 package-lock.json，确保 npm ci 幂等。
# 用 npm@10 + node:20-alpine（Next.js 15 + React 19 的官方推荐组合）。
FROM node:20-alpine AS deps
WORKDIR /app

# Alpine 上 better-sqlite3 需要 libc6-compat（musl glibc 符号 shim）+ 兜底编译链。
# prebuilt binary 默认从 github.com/WiseLibs/.../releases 拉，npmmirror 镜像一份。
# 设 binary host mirror 优先拉 npmmirror，缺则回源 GitHub；都没合适的就 build-from-source。
RUN apk add --no-cache libc6-compat python3 make g++

# 走 npmmirror（项目硬约束 CLAUDE.md §2）+ binary mirror。
ENV npm_config_better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
 && npm ci --no-audit --no-fund


# ---------- Stage 2: builder ----------
# next build：产出 .next/standalone（自包含 Node server）+ .next/static（静态资源）。
FROM node:20-alpine AS builder
WORKDIR /app

# builder stage 也需要编译链：next build 在 "Collecting page data" 阶段会执行
# API routes，那些 route 一上来就 import better-sqlite3。如果 prebuilt binary
# 在 alpine 上 ABI 不对（比如 32-bit / 老 Node），fallback 到 build-from-source
# 必须有 python3 + make + g++。
RUN apk add --no-cache libc6-compat python3 make g++

# next telemetry 在 CI 里关掉，避免污染构建日志。
ENV NEXT_TELEMETRY_DISABLED=1
# 让 builder 阶段也走 npmmirror binary mirror（万一 prebuilt 重下）。
ENV npm_config_better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# 强制 build-from-source：忽略 prebuilt binary，直接从 better-sqlite3 的 C++ 源码编译。
# v1.0-002/003/004 都挂在 'Failed to collect page data for /api/api-keys/[id]'，
# 根因是 deps 阶段拉下来的 prebuilt .node binary 跟 Alpine Node ABI 不匹配（即使
# binary mirror 设了，npmmirror 上偶尔会缺 musl-x64 的对应版本，npm fallback 不稳）。
# 强制从源码编译，保证 .node binary 一定对当前 Node 20-alpine 正确。
# 工具链（python3 + make + g++）已在前面装好。
RUN npm rebuild better-sqlite3 --build-from-source

# 验证 better-sqlite3 能正常 dlopen 并执行 SQL（这一行如果挂了说明源码编译失败）。
RUN node -e "const Database = require('better-sqlite3'); \
    const db = new Database(':memory:'); \
    db.exec('CREATE TABLE t(x INT)'); \
    db.prepare('INSERT INTO t VALUES (?)').run(42); \
    const row = db.prepare('SELECT x FROM t').get(); \
    console.log('better-sqlite3 verify OK:', JSON.stringify(row));"

# next.config.ts 已开 output: 'standalone'，这里跑 build。
# DB_PATH=:memory: 让 build 阶段也走内存 DB，避开 data/dev.db 在 builder 上下文
# 不存在 / 路径不同导致的副作用；prod 阶段会用真实 DB_PATH + -v /srv/.../data。
ENV DB_PATH=:memory:
# NEXT_DEBUG=1 让 next build 把 "Failed to collect page data" 背后的真实异常
# 完整打出来（默认会吞掉原 error，只显示 type: 'Error'）。
ENV NEXT_DEBUG=1
RUN npm run build


# ---------- Stage 3: runtime ----------
# 运行时：node:20-alpine + nginx:1.31-alpine 两个进程由 s6 / shell 拉起。
# 用同一个 alpine base，把 nginx 装进来，最省镜像体积。
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# nginx 在 alpine 主仓库（edge 才有 1.31）；锁 1.27 是 alpine 3.20 main 的稳定版。
# 如果需要 1.31，加 apk add nginx@nginx-mainline 并配 edge 仓库。
RUN apk add --no-cache nginx

# ---- Next.js standalone server ----
# .next/standalone/ 是一个自包含目录：server.js + 它需要的 node_modules 子集
# （含 better-sqlite3 的 prebuilt binary，前提是 builder stage 在 Alpine 上跑的）。
# 不要 COPY .next/standalone/node_modules/better-sqlite3 覆盖它——standalone 已经带。
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./

# 静态资源 + public：standalone 不带这两份，nginx 直接 serve 它们。
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# ---- nginx 配置 ----
COPY --chown=root:root deploy/nginx.conf /etc/nginx/nginx.conf

# ---- data/ 目录（SQLite 数据库文件）----
# prod 用 volume 挂 /app/data，镜像里只创建空目录、设权限。
RUN mkdir -p /app/data && chown -R nextjs:nodejs /app/data

# ---- 启动脚本 ----
# 顺序：先启 node server（后台），等它 ready，再启 nginx（前台保活）。
# 用 shell 而不是 s6 / tini：镜像体积最小，进程就两个，不需要 supervisor。
COPY --chown=root:root deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 安全：非 root 运行 next server（nginx 必须 root 才能 bind 80）。
# 添加 nextjs 用户是 node:20-alpine 镜像自带的；如果版本变化检查 /etc/passwd。
USER root

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ > /dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]