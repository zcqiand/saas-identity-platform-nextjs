/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // msw v2 has unresolvable @mswjs/interceptors exports conditions for
  // ClientRequest in browser; let Next.js transpile the package at build time.
  transpilePackages: ["@saas/identity-platform-msw"],
};

module.exports = nextConfig;
