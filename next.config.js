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
};

module.exports = nextConfig;
