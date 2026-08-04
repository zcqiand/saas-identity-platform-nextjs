# adr/

架构决策记录（ADR）。每条决策一篇，按编号递增。

**与 REF `output/saas-identity-platform/docs/adr/` 对齐**：同样的决策模式、相同的影响范围评估；差异在实现栈（Next.js ↔ React+Vite）。

Next.js 侧待写：

- Drizzle over SQLite 的 dev/prod 路径切换（dev: dev.db；prod: PostgreSQL via 同源 schema）
- NextAuth (Auth.js v5) vs 自研 JWT 资源服务器
- Server Actions vs Route Handlers 的使用边界
- App Router 缓存策略（`revalidate` / `unstable_cache`）

创建新 ADR 时按 `ADR-NNNN-<slug>.md` 命名，文件顶部三行内说清「什么时候读我」。
