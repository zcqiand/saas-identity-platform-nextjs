/**
 * vitest 模式下 'server-only' 模块的 stub。
 *
 * 'server-only' 在 next.js 生产构建时抛错，防止被意外打进 client bundle。
 * 但 vitest 跑在 node 里，没有 next bundler 上下文 → import 'server-only' 会失败。
 * 用 vite.config.ts 的 alias 把 'server-only' 重定向到这个空文件即可。
 */
export {};