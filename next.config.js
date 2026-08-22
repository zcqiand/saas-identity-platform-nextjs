/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // standalone 输出 — Dockerfile 的 `COPY .next/standalone ./` 需要它。
  // server.js 是 Next.js 生成的入口，runtime `node server.js` 启动（见
  // deploy/docker-entrypoint.sh:51）。
  output: "standalone",
  // ADR-0012 运行时 import 清零后，@saas/identity-platform-msw 不再进入构建图
  // （测试经 vitest setupNodeMocks 消费，与 next build 无关）。
  // 旧 transpilePackages / webpack alias（跨仓相对路径解析）已随之下线。
  //
  // pg 是 devDep（CLAUDE.md §3 硬约束不能升 dependencies）,但 scripts/sync-db.mjs
  // 在 runtime 用 createRequire + require('pg')。standalone 默认不 trace scripts/,
  // 所以用 Dockerfile runtime stage 显式 COPY pg + transitives（不靠
  // experimental.outputFileTracingIncludes,后者要 trace 入口从 app/ 起,对
  // scripts/ 路径不生效）。
};

module.exports = nextConfig;
