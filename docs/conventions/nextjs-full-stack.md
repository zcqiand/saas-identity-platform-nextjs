# nextjs-full-stack（v0.4.0）

> 本约定属于 `saas-identity-platform-nextjs` 仓。判断类规则；细则不写进 CLAUDE.md。
> 由 nextjs skill 按需加载。引用 ADR-0007 / ADR-0008 / ADR-0009。

## 后端 Route Handler

- 路径：`app/api/v1/<route>/route.ts`，对应 `saas-identity-platform-shared/generated/openapi/openapi.yaml` 全部 endpoints
- 首版 3 个 anchor（v0.4.0 落地）：`auth/login`、`me`、`tenants/:id/users`
- 每个 Route Handler **第一行** 调 `src/lib/tenant-guard.ts` 做 `:tenantId` vs JWT `tenant_id` claim 比对，不匹配返回 `Response(401)`
- JWT 解析走 `src/lib/jwt.ts`（读 `Authorization: Bearer ...`）；禁止把 JWT 解析逻辑写进 server action
- DTO 走 `src/api/endpoints/endpoints.schemas.ts`（orval 生成）；禁止手写 fetch + 字符串 URL

## 持久层

- `src/db/schema.ts`：Drizzle schema 定义，**镜像** `saas-identity-platform-shared/sql/migrations/*.sql`（字段名/类型/索引 1:1 对齐）
- `src/db/index.ts`：顶部 `'use server'` + `postgres(env.DATABASE_URL)` + `drizzle(client, { schema })`
- **禁止**调 `drizzle-kit generate` 产 SQL；SSOT 在 shared
- 迁移执行：`bash scripts/gen-shared.sh` 复制 shared SQL 到本仓 `migrations/` + `node-pg-migrate up`

## 凭据（ADR-0009）

- `.env.example`（commit）：模板，给后端开发者看格式
- `.env`（gitignore）：实际凭据；`DATABASE_URL=postgresql://postgres:...@host:5432/saas_dev`
- 远期切 secret manager 时改 `scripts/lib/db-env.sh` 一处即可

## runtime backend switcher 增项（**已废弃 — v0.4.0 / ADR-0014**）

- 旧 4 项：`msw` / `aspnetcore` / `springboot` / `nextjs-self`
- 整块 runtime 切换基础设施（BackendConfig 单例 / BackendProvider / BackendSwitcher UI / localStorage 持久化）已删除
- 后端 URL 改走 `NEXT_PUBLIC_API_BASE_URL`（部署期单 URL 配置，默认 `""` 同源调本仓 Route Handler 即原 `nextjs-self` 行为）
- MSW 启动门控改走 `NEXT_PUBLIC_ENABLE_MSW`（dev 默认 true，prod 默认 false）
- 详见 [../../../../docs/adr/0014-runtime-backend-switcher-removed.md](../../../../docs/adr/0014-runtime-backend-switcher-removed.md)

## 后续 phase 增量

- Phase 5：剩余 22 个 endpoint 实现，分摊
- Phase 6：跨端集成测试 + handoff