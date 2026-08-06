# =============================================================================
# saas-identity-platform-nextjs — 多阶段构建
#
#   deps      → 安装所有依赖（pg 是纯 JS，无 native build）
#   builder   → next build，产出 .next/standalone + .next/static
#   runtime   → 运行时只装 node + nginx；.next/standalone + 静态资源 + nginx 配置
#
# 数据库：PostgreSQL（远程）。容器内不持有 DB 文件，运行期必须通过
#         DATABASE_URL 环境变量注入连接串（如 postgresql://user:pwd@host:5432/db）。
#         `pg` 是纯 JS driver，无需 python3 / make / g++ 编译链。
#
# 参考：output/saas-identity-platform/DEPLOYMENT.md §2（容器内 nginx + 反代结构）
#       + Next.js standalone 官方推荐：https://nextjs.org/docs/app/api-reference/next-config-js/output
#
# 端口：
#   容器内：node server listen 3000（standalone server.js 默认 PORT=3000）
#           nginx listen 80（容器网关）
#   宿主机：docker run -p 127.0.0.1:8065:80 -e DATABASE_URL=...（VPS nginx 反代的上游端口）
# =============================================================================


# ---------- Stage 1: deps ----------
# 锁住整个 package-lock.json，确保 npm ci 幂等。
# 用 npm@10 + node:20-alpine（Next.js 15 + React 19 的官方推荐组合）。
# pg（node-postgres）是纯 JS，不需要 libc6-compat 也不需要 native 编译链。
FROM node:20-alpine AS deps
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm config set registry https://registry.npmmirror.com \
 && npm ci --no-audit --no-fund


# ---------- Stage 2: builder ----------
# next build：产出 .next/standalone（自包含 Node server）+ .next/static（静态资源）。
FROM node:20-alpine AS builder
WORKDIR /app

# next telemetry 在 CI 里关掉，避免污染构建日志。
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# next.config.ts 已开 output: 'standalone'，这里跑 build。
# build 期不需要连 DB：Next.js 在 "Collecting page data" 阶段会 import route
# 模块，但 Drizzle 的 Pool 是惰性连接，build 不发起真实查询。
# 运行时通过 DATABASE_URL 注入（见 runtime stage）。
RUN npm run build


# ---------- Stage 3: runtime ----------
# 运行时：node:20-alpine + nginx 两个进程由 shell 拉起。
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# nginx 在 alpine 主仓库稳定版。
RUN apk add --no-cache nginx

# ---- Next.js standalone server ----
# .next/standalone/ 是一个自包含目录：server.js + 它需要的 node_modules 子集
# （pg 是纯 JS，无 native binary）。
#
# chown 用 node:node（UID/GID 1000）—— node:20-alpine 镜像自带该用户。
COPY --from=builder --chown=node:node /app/.next/standalone ./

# 静态资源 + public：standalone 不带这两份，nginx 直接 serve 它们。
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# ---- nginx 配置 ----
COPY --chown=root:root deploy/nginx.conf /etc/nginx/nginx.conf

# ---- DATABASE_URL（运行期注入）----
# 不在镜像里硬编码：docker run -e DATABASE_URL=postgresql://... 时由 entrypoint
# 透传给 node server.js。这里只声明默认空值，提醒部署方必须覆盖。
ENV DATABASE_URL=

# ---- 启动脚本 ----
# 顺序：先启 node server（后台），等它 ready，再启 nginx（前台保活）。
COPY --chown=root:root deploy/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER root

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ > /dev/null || exit 1

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
