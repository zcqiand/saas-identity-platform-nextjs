/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@saas/shared": require("path").resolve(__dirname, "../saas-identity-platform-shared/generated/ts"),
    };
    return config;
  },
};
module.exports = nextConfig;