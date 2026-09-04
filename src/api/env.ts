// REF import.meta.env.VITE_* → Next.js process.env.NEXT_PUBLIC_* 的唯一适配点。
//
// 后端配置（ADR-0014）：
//   NEXT_PUBLIC_API_BASE_URL   单 URL 后端地址；ADR-0019 禁 localhost 兜底
//   NEXT_PUBLIC_API_MODE       显示标签；infra 默认 "msw-http"
//
// ADR-0012 v0.3.0：删除 NEXT_PUBLIC_ENABLE_MSW（Service Worker 模式已删除）。
// ADR-0019：NEXT_PUBLIC_API_BASE_URL 缺失 throw，不允许 fallback 到 localhost。
//   dev 期用 docker compose 注入或 .env.local；prod 由 deploy 脚本生成。
//
// 服务端 env（route handler / drizzle / 等）：
//   DATABASE_URL、SAAS_CORS_ALLOWED_ORIGINS、JWT_* 见 .env.example
//
// ?? 而非 ||：env 对象在模块加载时构造，烤进 client bundle。
// 空串 "" 是「显式设空」（测试同源相对 URL 模式），?? 只在 null/undefined 时 throw。
function requireEnv(name: string): string {
  const v = process.env[name];
  if (v === undefined) {
    throw new Error(
      `${name} env is required (ADR-0019 禁字面默认值). ` +
        `Set in .env.local (dev) or Dockerfile ENV (prod).`,
    );
  }
  return v;
}

export const env = {
  // ADR-0019：缺失 throw，dev 期 .env.local 显式声明 (例 NEXT_PUBLIC_API_BASE_URL=http://localhost:5100)
  // 测试模式 .env.test 设空串 = 同源相对 URL，走 msw 相对路径 handler
  NEXT_PUBLIC_API_BASE_URL: requireEnv("NEXT_PUBLIC_API_BASE_URL"),
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE ?? "msw-http",
} as const;