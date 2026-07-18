/**
 * vitest setup hook — 每个测试文件运行前调一次。
 *
 * 主要职责：
 * 1. 提供 server-only 的 stub（vitest 没有 next bundler 上下文，import 'server-only'
 *    会跑不通；用 vite alias 把它指到 server-only.stub.ts）。
 * 2. 强制时区 UTC，避免 SQLite datetime('now') 在跨时区测试时跨日漂移。
 */
process.env.TZ = "UTC";