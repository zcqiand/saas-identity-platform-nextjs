// REF import.meta.env.VITE_* → Next.js process.env.NEXT_PUBLIC_* 的唯一适配点。
//
// 后端配置（ADR-0014）：
//   NEXT_PUBLIC_API_BASE_URL   单 URL 后端地址；ADR-0019 禁 localhost 兜底
//   NEXT_PUBLIC_API_MODE       显示标签；默认 "nextjs"（msw 剔除后）
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
//
// ⚠ 必须字面访问 process.env.NEXT_PUBLIC_*：DefinePlugin 只内联字面 key，
// 动态 key（requireEnv(name) 中转）让 client bundle 拿到 undefined → 浏览器必炸
// （build/SSR 全绿掩盖；2026-09-11 E2E 首跑抓到的复发坑）。
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
if (API_BASE_URL === undefined) {
  throw new Error(
    "NEXT_PUBLIC_API_BASE_URL env is required (ADR-0019 禁字面默认值). " +
      "Set in .env.local (dev) or Dockerfile ENV (prod).",
  );
}

export const env = {
  // ADR-0019：缺失 throw，dev 期 .env.local 显式声明 (例 NEXT_PUBLIC_API_BASE_URL= 留空同源)
  // 测试模式 .env.test 设空串 = 同源相对 URL，走本仓相对路径 handler
  NEXT_PUBLIC_API_BASE_URL: API_BASE_URL,
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE ?? "nextjs",
} as const;
