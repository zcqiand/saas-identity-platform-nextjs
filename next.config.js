const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // msw v2 has unresolvable @mswjs/interceptors exports conditions for
  // ClientRequest in browser; let Next.js transpile the package at build time.
  transpilePackages: ["@saas/identity-platform-msw"],
  // 本仓源码用 '../saas-identity-platform-msw/src/...' 跨仓相对路径 (见 app/api/v1/*/route.ts),
  // next.js webpack 默认只在项目根 + node_modules 里解析,会报 Module not found。
  // webpack resolve.alias 把 '../saas-identity-platform-{msw,shared}' 映射到 sibling 仓根。
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "../saas-identity-platform-msw": path.resolve(__dirname, "../saas-identity-platform-msw"),
      "../saas-identity-platform-shared": path.resolve(__dirname, "../saas-identity-platform-shared"),
    };
    return config;
  },
};

module.exports = nextConfig;
