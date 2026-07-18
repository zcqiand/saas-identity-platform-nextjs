import type { NextConfig } from "next";

/**
 * Next.js 配置。better-sqlite3 是 native binding，Drizzle 的 SQLite driver 仍然依赖它，
 * 不能被打包进 server bundle 之外的产物 —— Next 默认就 external，
 * 这里显式声明是为了在升级 next 时第一时间被 regressed 注意到。
 */
const nextConfig: NextConfig = {
  serverExternalPackages: ["better-sqlite3"],
  typedRoutes: true,
};

export default nextConfig;
