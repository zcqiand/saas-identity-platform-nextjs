# 0008. saas-identity-platform-nextjs 扩展为全栈（Frontend + Backend + DB）

- 状态: Accepted
- 日期: 2026-08-13
- 决策者: 项目所有者

## Context

文章 §4 描述的「三端架构」是：Next.js（Node/TS）+ ASP.NET Core（C#）+ Spring Boot（Java），三个后端都持有 PostgreSQL。

`saas-identity-platform-nextjs` 当前是 App Router 前端：`page.tsx` + shadcn-ui + orval 调 API + MSW mock。`profiles/nextjs.toml` 已经 scaffold 了 `src/db/schema.ts`、`src/db/index.ts`、`drizzle.config.ts`、`src/app/api/health/route.ts`、`tests/db.smoke.test.ts` —— profile 当初就预见到了「nextjs 既前端也后端」的全栈形态，但当时没接 PG，默认 SQLite。

用户决策讨论时有选项：

1. 新建 `saas-identity-platform-nextjs-backend` 子模块，与现有 nextjs 平级
2. 把现有 `saas-identity-platform-nextjs` 扩展为「同仓前后端」（App Router 进程同时跑 `page.tsx` + `app/api/v1/.../route.ts`）

## Decision

选项 2。`saas-identity-platform-nextjs` 扩展为：

- **Frontend**（已有）：`app/<route>/page.tsx` + shadcn-ui + MSW mock（dev/test）
- **Backend**（新增）：`app/api/v1/<route>/route.ts` Route Handler，对应 shared/openapi.yaml 全部 endpoints（首版 3 个 anchor：`auth/login`、`me`、`tenants/:id/users`）
- **DB**（已有 scaffold 但空）：`src/db/schema.ts` 改为 Postgres（`drizzle-orm/postgres-js` 驱动），`drizzle.config.ts` 仅作 schema 镜像工具，**不调** `drizzle-kit generate` 产 SQL

runtime backend switcher（react / vue / nextjs 前端用，当前列 msw / aspnetcore / springboot 三项）增加第 4 项 `nextjs-self`：调自己仓的 `app/api/v1/` Route Handler，便于「前端代码 + 自己 backend」端到端调试，无需启外部服务。

profile 拆分：

- `profiles/nextjs.toml`（保留）：纯前端模板，driver SQLite，给现有 6 个 nextjs 前端子仓继续用
- `profiles/nextjs-backend.toml`（新增）：full-stack 模板，driver `postgres-js`，scaffold 加 `src/app/api/v1/_example/route.ts` 占位 + `src/lib/{jwt,tenant-guard}.ts`

## Alternatives considered

### 新建 `saas-identity-platform-nextjs-backend` 子模块
被拒绝。理由：

- App Router 是同进程前后端架构，分两个仓等于「同一组 route + page」跨仓维护，merge conflict 频繁
- runtime backend switcher 本就是「前端选哪个后端」的抽象，多一个 `nextjs-self` 选项即可，无需新仓
- shared submodule gitlink 列表与 `sync_function_tree.mjs` 的 `SHARED_REPOS` 数组不动，减治理面
- 现有 `nextjs.toml` 已经预留了 `src/db/schema.ts` 与 `src/app/api/health/route.ts` —— 选 1 等于把已有 scaffold 抛弃重做

### 把 backend 部分塞到 `saas-identity-platform-msw` 仓
被拒绝。msw 仓职责是「前端 MSW mock fixtures + cross-test 共享数据」，与「真实 backend 路由」语义不同。混入会污染 msw 的 L4 验证目标（目前 msw 是 handler-only 单测）

### 完全放弃 nextjs 后端化，只做 springboot + aspnetcore
被拒绝。违背用户原始决策「三个后端都加 DB（按文章 §4）」。文章 §4 明确把 Next.js 列为三端之一

## Consequences

正面：

- 同一仓库同时承载 frontend + backend + DB，`git log` 一次 commit 涵盖三端改动，便于 PR review
- 复用 nextjs profile 已有的 `src/db/` scaffold，省下一半脚手架工作
- runtime backend switcher 加 `nextjs-self` 后，前端在「真后端」与「自后端」之间零成本切换

负面：

- App Router 进程同时跑 server-side 与 client-side，bundle 体积、cold start 时间比纯 frontend nextjs 大（影响首屏 LCP）
- `import "server-only"` 与 `'use server'` 标记在 Route Handler 与 Page Component 之间要严格区分，写错会被 webpack 误打入 client bundle；profile `[stack_rules].forbid` 必须加禁项
- 现有 6 个 nextjs 前端子仓依赖 `nextjs.toml`；新增 `nextjs-backend.toml` 不能污染 `nextjs.toml` 的契约（保留 SQLite 与 MSW）
- `nextjs-backend.toml` 的 scaffold 跟 `nextjs.toml` 大部分重叠，未来若 nextjs 升级（如 15 → 16），两份 profile 都要同步升级
- 25 个 OpenAPI endpoint 一次性实现 25 个 Route Handler 工作量大；首版只做 3 个 anchor，剩余分摊到后续 phase

## 6. 实现日志

### 2026-08-19 — M03/M04 auth 批次（5 路由 + 2 增强 + 1 in-memory store）

落地 5 个新 Route Handler（`/auth/oidc/callback`、`/oauth/authorize`、`/oauth/token`），并对现有 `/auth/login` 加锁定策略（`LOCKOUT_MAX_FAILS` / `LOCKOUT_WINDOW_MIN` / `LOCKOUT_COOLDOWN_MIN`）+ `audit_events` 写 `login_success`/`login_failed`、对 `/auth/refresh` 切到 `src/lib/oauth-store.ts` in-memory Map（与 saas-msw `handlers-extra.ts` 同款语义：code 一次性、refresh token rotation）。

新增两个进程内工具：`src/lib/oauth-store.ts`（`oauthCodes` + `oauthRefreshTokens` Maps + TTL 懒清理 + `generateAuthCode`/`generateAccessToken`/`generateRefreshToken` 三个 helper）、`src/lib/login-lockout.ts`（按 username 计失败次数，窗口 + 冷却）。

`M03.F03.I06`（全局 SSO logout）在 shared OpenAPI 无对应端点；保留 `规划`，记 `open_item`。

HS256 真签发延后到 Phase 5；当前 dev 占位 `alg:none` base64url，但 `JWT_SIGNING_KEY` 已读 env 并对未设置打 `console.warn`（仅 dev 路径）。

环境变量新增 11 个：`LOCKOUT_MAX_FAILS` / `LOCKOUT_WINDOW_MIN` / `LOCKOUT_COOLDOWN_MIN` / `OAUTH_CODE_TTL` / `OAUTH_REFRESH_TTL` / `OIDC_ISSUER` / `OIDC_CLIENT_SECRET` / `SAAS_CORS_ALLOWED_ORIGINS` / `NEXT_PUBLIC_LAB_BASE_URL` / `JWT_ISSUER` / `JWT_AUDIENCE` / `JWT_TTL_SECONDS`（其中 `JWT_SIGNING_KEY` 已声明但未读，本批次接通）；命名与 springboot（`LAB_JWT_SECRET` / `SAAS_CORS_ALLOWED_ORIGINS`）和 aspnetcore（`Jwt.SigningKey` / `Saas.Cors.AllowedOrigins`）镜像。

`docs/functions/function-tree.md` M03.F01.I01/I02 + M03.F02.I04 + M03.F03.I05 + M04.F03.I07/I08/I09 翻 `已上线`（5 项 fnTest 覆盖）；M03.F02.I03 翻 `开发中`（路由已加但 fnTest 未覆盖）；M03.F03.I06 维持 `规划`（无 OpenAPI 端点）。

fnTest 覆盖：`tests/integration/{oauth-authorize,oauth-token,auth-oidc-callback,auth-refresh,auth-login}.test.ts` 共 5 个文件 ~25 条 `it()`；test 名称内嵌 `M\d{2}\.F\d{2}\.I\d{2}`，由 `tests/fnReporter.ts` 正则提取写入 `.state/trace.json`。

后续 session：Phase 5 jose HS256 真签发 + verify；Phase 6 oauth-store → Redis（TTL 后台清理 + 多进程共享）；远期真 OIDC 替换 dev echo。