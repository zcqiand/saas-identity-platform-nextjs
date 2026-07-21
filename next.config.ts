import type { NextConfig } from "next";

/**
 * Next.js 配置。better-sqlite3 是 native binding，Drizzle 的 SQLite driver 仍然依赖它，
 * 不能被打包进 server bundle 之外的产物 —— Next 默认就 external，
 * 这里显式声明是为了在升级 next 时第一时间被 regressed 注意到。
 *
 * `output: 'standalone'` 让 `next build` 产出 `.next/standalone/`，里面是
 * 一个自包含的 Node.js server（server.js + 仅需要的 node_modules 子集），
 * 是 deploy/Dockerfile 多阶段构建的关键 —— runtime 镜像不需要装 dev deps。
 *
 * 注意：better-sqlite3 这种带 prebuilt binary 的 native dep 必须显式 COPY 进
 * standalone 镜像（Dockerfile 里处理），next 自己只 follow JS 依赖图。
 */
const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  typedRoutes: true,
};

export default nextConfig;
