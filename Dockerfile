# =============================================================================
# saas-identity-platform-nextjs — 生产镜像
#
#   builder  → 安装 deps + next build（standalone 输出）
#   runtime  → node:24-slim + standalone server，监听 PORT=3000
#
# 数据库：PostgreSQL（远程）。容器内不持有 DB 文件 —— 运行期必须通过
#         DATABASE_URL 环境变量注入连接串（由 VPS saas.env 注入）。
#         `pg` 是纯 JS driver，无需 python3/make/g++ 编译链。
#
# 迁移 / seed：在 docker-entrypoint.sh 里跑 scripts/sync-db.mjs + scripts/seed-db.mjs
#         （seed 仅首启执行，靠 __schema_migrations 是否为空判断）。
#
# 端口：容器内 next start 监听 :3000；VPS nginx 反代到 publish 出的端口（默认 8065）。
#
# 节点用户：slim 镜像只有 root；我们用 `node` 用户跑 next（v1.0-007 教训：
#         chown -R nextjs:nodejs 报 'invalid user'）。
# =============================================================================


# ---------- Stage 1: builder ----------
FROM node:24-slim AS builder
WORKDIR /app

# 硬约束：npm 依赖一律走 npmmirror（CLAUDE.md §2）。
RUN npm config set registry https://registry.npmmirror.com

# 拉 sibling 仓（file: 依赖 + gen:shared 需要 sibling 存在）
# msw: package.json 的 @saas/identity-platform-msw@file:../saas-identity-platform-msw
# shared: npm run gen:shared 调 ../saas-identity-platform-shared/scripts/codegen/emit-openapi.ts
RUN git clone --depth 1 https://github.com/zcqiand/saas-identity-platform-msw.git ../saas-identity-platform-msw \
 && git clone --depth 1 https://github.com/zcqiand/saas-identity-platform-shared.git ../saas-identity-platform-shared

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# standalone build 不需要 DB 连接（除非某 route 顶层 open DB）：gen:shared 只读
# yaml，不连 DB；sync-db / seed-db 留到 runtime entrypoint 跑。
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build


# ---------- Stage 2: runtime ----------
FROM node:24-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone/server.js 是 Next 生成的入口
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

# scripts/：sync-db / seed-db，entrypoint.sh 会调用
COPY --from=builder --chown=node:node /app/scripts ./scripts
COPY --from=builder --chown=node:node /app/package.json ./package.json

# data/ 占位（PG 模式下不真用，但避免 entrypoint 写 /data 时无目录）
RUN mkdir -p /data && chown -R node:node /data

# entrypoint
COPY --chown=root:root deploy/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000

# slim 没有 wget/curl，用 node fetch 探活
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
