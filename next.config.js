/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone 输出 — Dockerfile 的 `COPY .next/standalone ./` 需要它。
  // server.js 是 Next.js 生成的入口，runtime `node server.js` 启动（见
  // deploy/docker-entrypoint.sh:51）。
  output: "standalone",
  // standalone 默认只 trace app/ pages/ src/ 入口路径下的 import 图。
  // scripts/sync-db.mjs 不在 trace 范围 → 它 `require('pg')` 在 runtime
  // 找不到模块。pg 是 devDep（CLAUDE.md §3 硬约束不能升 dependencies）。
  // 解法：outputFileTracingIncludes 显式把 pg + transitives 拷进
  // .next/standalone/node_modules/，scripts/ 启动时 require 才能命中。
  experimental: {
    outputFileTracingIncludes: {
      "/": [
        "./node_modules/pg/**",
        "./node_modules/pg-types/**",
        "./node_modules/pgpass/**",
        "./node_modules/pg-int8/**",
      ],
    },
  },
  // ADR-0012 运行时 import 清零后，@saas/identity-platform-msw 不再进入构建图
  // （测试经 vitest setupNodeMocks 消费，与 next build 无关）。
  // 旧 transpilePackages / webpack alias（跨仓相对路径解析）已随之下线。
};

module.exports = nextConfig;
