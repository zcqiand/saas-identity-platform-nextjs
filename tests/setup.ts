/**
 * vitest setup hook — 每个测试文件运行前调一次。
 *
 * 主要职责：
 * 1. 触发 per-worker schema 隔离（建 schema + 跑迁移 + 注入 VITEST_SCHEMA）。
 *    必须排在本文件第一行，保证 src/db 被 import 前完成 schema 注入。
 * 2. 强制时区 UTC，避免 pg now() 在跨时区测试时跨日漂移。
 *
 * server-only 的 stub 走 vitest config 的 alias，不在这里处理。
 */
import "./setup-db";

process.env.TZ = "UTC";
