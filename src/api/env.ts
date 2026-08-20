// REF import.meta.env.VITE_* → Next.js process.env.NEXT_PUBLIC_* 的唯一适配点。
//
// 后端配置（ADR-0014）：
//   NEXT_PUBLIC_API_BASE_URL   单 URL 后端地址；默认 "" 同源
//   NEXT_PUBLIC_ENABLE_MSW     Service Worker 启动开关（dev 默认 true，prod 默认 false）
//   NEXT_PUBLIC_API_MODE       显示标签；默认 "msw"
//
// 服务端 env（route handler / drizzle / 等）：
//   DATABASE_URL、SAAS_CORS_ALLOWED_ORIGINS、JWT_* 见 .env.example
export const env = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || "",
  NEXT_PUBLIC_ENABLE_MSW:
    process.env.NEXT_PUBLIC_ENABLE_MSW !== undefined
      ? process.env.NEXT_PUBLIC_ENABLE_MSW === "true"
      : process.env.NODE_ENV !== "production",
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE || "msw",
} as const;