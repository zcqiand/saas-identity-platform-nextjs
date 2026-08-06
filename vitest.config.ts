import { defineConfig } from "vitest/config";
import FnReporter from "./tests/fnReporter";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

// 加载 .env.test：测试期 DATABASE_URL 指向 saas_test。
// （dotenv 默认不覆盖已存在的 process.env，但这里环境干净，无需 override。）
loadEnv({ path: ".env.test" });

/**
 * vitest 配置。Next.js 项目里两件事必须分开：
 *  1. 排除 .next/、node_modules/，让 vitest 走原生 ESM 解析而不是 next 的编译器
 *  2. 测试连 saas_test（pg），每 worker 一个 schema，互不污染（见 tests/setup-db.ts）
 *
 * `server-only` alias：Next 的 RSC bundler 根据上下文换 server index.js / client empty.js，
 * 但在裸 Node ESM（vitest）里直接执行会 throw。把空模块重定向到 server-only 空 stub。
 */
export default defineConfig({
  // Next 的 tsconfig.json 用 jsx: "preserve"（交给 SWC），但 vitest 默认用 esbuild
  // 解析 .tsx，esbuild 会继承 tsconfig 的 preserve 导致 vite 拿到原始 JSX 报错。
  // 显式声明 automatic 运行时（React 19 的默认），让 esbuild 把 JSX 编译成
  // react/jsx-runtime 调用。只影响 vitest，不改 tsconfig。
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "node",
    // forks pool：每个 worker 是独立子进程，独立 pg 连接池 + 独立 schema。
    // 避免线程池共享进程导致 VITEST_SCHEMA 串号。
    pool: "forks",
    include: ["tests/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", "dist", ".next", "src/**/*.{test,spec}.{ts,tsx}"],
    // setup-db 必须排第一：它同步注入 VITEST_SCHEMA，store 文件 import @/db 时才能读到。
    setupFiles: ["tests/setup-db.ts", "tests/setup.ts"],
    // beforeAll 里跑 pg 迁移到远端库，首次连接较慢；放宽 hook 超时。
    hookTimeout: 60000,
    env: {
      AUTH_JWT_SECRET: "test-secret-do-not-use-in-prod",
    },
    reporters: ["default", new FnReporter()],
  },
  resolve: {
    alias: {
      "@": new URL("./src", import.meta.url).pathname,
      "server-only": fileURLToPath(new URL("./tests/server-only.stub.ts", import.meta.url)),
    },
  },
});
