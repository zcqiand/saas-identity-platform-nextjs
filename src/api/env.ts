// REF import.meta.env.VITE_* → Next.js process.env.NEXT_PUBLIC_* 的唯一适配点。
//
// 后端配置（ADR-0014）：
//   NEXT_PUBLIC_API_BASE_URL   单 URL 后端地址；默认 "http://localhost:5100" msw-http
//   NEXT_PUBLIC_API_MODE       显示标签；默认 "msw-http"
//
// ADR-0012 v0.3.0：删除 NEXT_PUBLIC_ENABLE_MSW（Service Worker 模式已删除）。
//
// 服务端 env（route handler / drizzle / 等）：
//   DATABASE_URL、SAAS_CORS_ALLOWED_ORIGINS、JWT_* 见 .env.example
//
// ?? 而非 ||：env 对象在模块加载时构造，烤进 client bundle。
// 空串 "" 在 prod 是「同源」（nginx 反代），|| 会把空串吞回 "http://localhost:5100"
// → 浏览器 fetch localhost:CORS fail。?? 只在 null/undefined 时 fallback。
export const env = {
  NEXT_PUBLIC_API_BASE_URL:
    process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5100",
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE ?? "msw-http",
} as const;