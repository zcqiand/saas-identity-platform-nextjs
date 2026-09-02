# saas-identity-platform-nextjs Architecture

> Next.js 15 + App Router + TS 5.7 + shadcn-ui + Tailwind v4 + Drizzle ORM (Postgres) + jose HS256。**全栈子仓**：同一仓库同时承载 Frontend、Backend Route Handler、DB schema 三种角色——见 [ADR-0008](adr/0008-nextjs-full-stack.md)。与 `saas-identity-platform-react` / `saas-identity-platform-vue` 两个纯前端仓形成鲜明对比。

> **范围**：本文档只描述 *架构*（结构 / 边界 / 数据流 / 决策）。
> 编码细则见 [docs/conventions/](conventions/)，CLAUDE.md 入口见根目录，技术栈与禁止事项见父仓 [docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)。

---

## 0. 阅读路径

| 你是… | 直接看 |
|---|---|
| 第一次进本仓 | §1 → §2 → §3（前后端分述） |
| 要加一个新 API 端点 | §3.2 → §4（数据流）→ [ADR-0008](adr/0008-nextjs-full-stack.md) |
| 要加一张表 / 改字段 | §3.3 → [ADR-0007](../../docs/adr/0007-shared-sql-ssot.md) → §6.2（DB schema SSOT） |
| 想问「为什么这样设计」 | §6（决策索引）→ 对应 ADR |
| 与 react/vue 仓做对照 | 附录 B（差异对照） |

---

## 1. 双角色定位（ADR-0008 全栈形态）

`saas-identity-platform-nextjs` 在 suite 14 子仓里**独一无二**：

```
saas-identity-platform-react  ─┐
saas-identity-platform-vue    ─┼─→ 纯前端仓（vite dev server :5103，调外部后端）
saas-identity-platform-nextjs ─┘
                                 ↑ 本仓
                                 │
                                 └── 同时是 Backend + DB（App Router 进程 :3000）
```

| 维度 | react / vue 仓 | nextjs 仓（本仓） |
|---|---|---|
| 角色 | 前端 1/N | 前端 1/N **+ Backend + DB** |
| 进程 | vite dev server（client-side SPA） | next dev（App Router：page + route handler 同进程） |
| 后端实现 | —（只调外部） | `app/api/v1/<route>/route.ts` Route Handler |
| DB schema | —（不持有） | `src/db/schema.ts`（Drizzle，镜像 shared SQL） |
| Driver | — | postgres-js + drizzle-orm/postgres-js |
| JWT 签发 | 不签 | `src/lib/jwt.ts`（jose HS256 真签发） |
| OAuth store | 不存 | `src/lib/oauth-store.ts`（in-memory Map） |
| TenantGuard | 不调 | `src/lib/tenant-guard.ts`（路径 vs claim 校验） |
| 端口 | 5103 | 5101（同源；调自己 `app/api/v1/`） |
| CORS | 跨源（需白名单 3000） | 同源（不需要 CORS） |

**含义**：

- 一份 git commit 涵盖前后端 + DB schema 三处改动，PR review 时一并审；
- 同进程意味着首屏 LCP 比纯前端 nextjs 略大（`import "server-only"` 与 `'use server'` 标记必须严格区分）；
- 测试用 `next dev` 起 server，fetch `http://localhost:5101/api/v1/...` 是真实路径，不是 mock。

详见 [ADR-0008 §Context](adr/0008-nextjs-full-stack.md)。

---

## 2. 目录骨架

### 2.1 顶层布局

```
saas-identity-platform-nextjs/
├── CLAUDE.md                         ← 入口：技术栈 + 禁止事项（v0.4.0 hard rules）
├── .harness/stack.json               ← suite 门禁读取的项目自描述（声明 L1-L4）
├── docs/
│   ├── functions/function-tree.md    ← M00-M09 + F/I 子项（M03 大部分已上线）
│   ├── adr/                          ← 本仓特有 ADR（0008 全栈决策 + 0007/0009/0010 父仓 ADR 引用）
│   ├── design/                       ← 流程/设计（人评审）
│   ├── conventions/                  ← 本仓编码细则（nextjs-full-stack.md / nextjs-env-driven.md / ...）
│   ├── requirements/                 ← 需求文档
│   ├── ARCHITECTURE.md               ← 本文件
│   └── saas-identity-platform-v0.3.0-shadcn-ui-migration.md
├── app/                              ← App Router（**同仓同时是 frontend + backend**）
│   ├── page.tsx                      ← 根页面
│   ├── layout.tsx                    ← 全局 layout
│   ├── login/page.tsx                ← M03.F01 登录页
│   ├── tenants/[tenantId]/...        ← M00 跨租户切换 + M01 用户 + M02 角色 + M05 key + M06 审计
│   ├── admin/apps/[appId]/menus/     ← M04 应用 + M08 菜单 + M09 授权
│   └── api/
│       └── v1/
│           ├── auth/{login,logout,refresh,oidc/callback}/route.ts      ← M03
│           ├── oauth/{authorize,token}/route.ts                        ← M04 OAuth
│           ├── me/{,tenants,menus}/route.ts                            ← M00 whoami + 切换 + 菜单
│           ├── me/tenants/[tenantId]/switch/route.ts                   ← M00 切换当前租户
│           ├── tenants/[tenantId]/{users,roles,api-keys,audit-events}/ ← M01/M02/M05/M06
│           ├── tenants/[tenantId]/roles/[roleId]/{menus,permissions}/  ← M09 / M02.F02
│           ├── admin/{tenants,apps}/...                                ← M00 admin + M04 admin
│           └── apps/[code]/route.ts                                    ← 应用公开信息
├── src/
│   ├── api/                          ← orval codegen + http client + env 适配
│   ├── components/
│   │   ├── ui/                       ← 14 个 shadcn-ui SFC（与 react 仓 1:1）
│   │   ├── app/                      ← 7 个核心基建（app-shell / sidebar-nav / crud-dialog / ...）
│   │   └── providers.tsx / require-auth.tsx / tenant-switcher.tsx
│   ├── db/
│   │   ├── schema.ts                 ← Drizzle PG schema（**镜像 shared SQL**）
│   │   └── index.ts                  ← postgres-js driver + drizzle 入口（server-only）
│   ├── lib/
│   │   ├── jwt.ts                    ← jose HS256 真签发 + 验签
│   │   ├── tenant-guard.ts           ← 路径 :tenantId vs JWT tenant_id claim
│   │   ├── oauth-store.ts            ← in-memory Map（code 一次性 + refresh rotation）
│   │   ├── login-lockout.ts          ← 进程内失败计数器 → 429 ACCOUNT_LOCKED
│   │   ├── app-resolver.ts           ← 应用 code → appId 解析
│   │   └── utils.ts                  ← cn() 等工具
│   ├── seeds/                        ← sync-db 灌库 fixture（manifest.json + 10 个 *.json）
│   ├── state/
│   │   ├── tenant-context.tsx        ← tenantProvider（lazy initializer 同步 hydrate）
│   │   └── selection-context.tsx     ← 多租户/多应用「焦点选中」状态
│   └── app/globals.css               ← Tailwind v4 入口
├── tests/                            ← vitest + fnTest + tests/fnReporter.ts
│   ├── unit/                         ← 纯函数 / 模块测试
│   ├── integration/                  ← 端到端（含 5 个 auth 批次集成）
│   └── db.smoke.test.ts              ← DB schema 镜像 sanity
├── scripts/                          ← gen-shared.sh（cp shared SQL + drizzle + orval）
├── middleware.ts                     ← Next.js middleware（鉴权 + tenant context）
├── next.config.js / orval.config.ts
├── package.json / package-lock.json
├── Dockerfile / .dockerignore / .npmrc
├── .env.example / .env.local / .env.production
└── deploy/                           ← 生产部署脚本
```

### 2.2 角色分布

| 目录 | 角色 | 谁来读 |
|---|---|---|
| `app/<route>/page.tsx` + `app/<route>/layout.tsx` | **Frontend** 页面（client + server components） | 浏览器 |
| `app/api/v1/<route>/route.ts` | **Backend** Route Handler | 浏览器 / 同仓前端 / msw handler |
| `src/db/schema.ts` + `src/db/index.ts` | **DB** schema + driver | Route Handler / Server Action |
| `src/lib/{jwt,tenant-guard,oauth-store,login-lockout}.ts` | **后端基建** | Route Handler |
| `src/api/{env,backend-config,http-client}.ts` | **前端基建** | 浏览器 fetch 链 |
| `src/components/{app,ui}/` | **UI 组件** | 页面 / 业务组件 |
| `src/state/*-context.tsx` | **前端状态** | client components |
| `src/seeds/*.json` | **DB fixture** | `npm run sync-db` 灌库 |
| `docs/adr/0008-nextjs-full-stack.md` | **本仓决策** | 阅读 |

---

## 3. 核心模块（三大层）

### 3.1 Frontend 层

**职责**：把 backend 返回的数据 + shadcn-ui + 业务组件拼成可见的页面；env-driven 决定调哪个后端（同源 nextjs-self / 跨源 msw-http :5100 / 跨源 aspnetcore / 跨源 springboot）。

#### 3.1.1 页面入口

```
app/
├── page.tsx                              ← 首页（重定向到 /login 或 /tenants）
├── layout.tsx                            ← 顶层 providers 包裹（tenant / selection / backend）
├── login/page.tsx                        ← M03.F01 登录
├── tenants/
│   ├── page.tsx                          ← M00.F02 跨租户切换
│   └── [tenantId]/
│       ├── users/page.tsx                ← M01.F01 用户 CRUD
│       ├── roles/page.tsx                ← M02.F01 角色 CRUD
│       ├── roles/[roleId]/menus/page.tsx ← M09.F02 角色菜单授权
│       ├── api-keys/page.tsx             ← M05.F01 API Key
│       └── audit/page.tsx                ← M06.F01 审计事件
├── admin/
│   ├── apps/page.tsx                     ← M04.F01 应用 CRUD（平台 admin）
│   └── apps/[appId]/menus/page.tsx       ← M08.F01 菜单树
└── apps/[code]/page.tsx                  ← 应用公开页
```

#### 3.1.2 UI 组件

| 组件库 | 数量 | 路径 | 备注 |
|---|---|---|---|
| shadcn-ui SFC | 14 | `src/components/ui/` | 与 react 仓 1:1（button/card/dialog/select/table/...） |
| 业务组件 | 14 | `src/components/app/` | app-shell / sidebar-nav / crud-dialog / data-table / ...（含 BackendBadge footer） |
| Context | 2 | `src/state/` | tenant-context / selection-context（lazy initializer 同步 hydrate） |

#### 3.1.3 7 个核心基建（详见 §5）

`app-shell.tsx` / `sidebar-nav.tsx` / `backend-config.ts` / `env.ts` / `backend-badge.tsx` / `crud-dialog.tsx` / `selection-context.tsx`。

#### 3.1.4 env-driven 后端配置（ADR-0014）

```ts
// src/api/env.ts（唯一 process.env.NEXT_PUBLIC_* 适配点）
export const env = {
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5100",
  NEXT_PUBLIC_API_MODE: process.env.NEXT_PUBLIC_API_MODE ?? "msw-http",
} as const;

// src/api/backend-config.ts（3 个 getter）
export function getApiBaseUrl(): string { return env.NEXT_PUBLIC_API_BASE_URL; }
export function getApiMode(): string { return env.NEXT_PUBLIC_API_MODE; }
// isMswEnabled() 已删除 — ADR-0012 v0.3.0 Service Worker 模式彻底移除
```

**dev 没设 env** → fallback 到 `http://localhost:5100`（saas-msw HTTP server）；**prod 设空串** → 同源相对路径（nginx 反代到 127.0.0.1:8022 容器）。`??` 而非 `||` 是关键（详见 `memory/axios-baseurl-no-path-prefix.md` 与本仓注释）。

### 3.2 Backend 层

**职责**：在 App Router 进程内提供 `/api/v1/*` 端点；用 Drizzle 读 PG，jose 签 JWT，in-memory Map 维护 OAuth code/refresh，按 shared OpenAPI 全实现（首版 M03 auth 批次 5 路由 + 后续批次展开）。

#### 3.2.1 Route Handler 布局

```
app/api/v1/
├── auth/
│   ├── login/route.ts                            ← M03.F01.I01/I02（账号密码 + 锁定）
│   ├── refresh/route.ts                          ← M03.F02.I04 refresh token
│   ├── logout/route.ts                           ← M03.F03.I05 登出（本地清理）
│   └── oidc/callback/route.ts                    ← M03.F02.I03 OIDC Code 换取
├── oauth/
│   ├── authorize/route.ts                        ← M04.F03.I07 授权码签发
│   └── token/route.ts                            ← M04.F03.I08/I09 令牌交换 + 刷新
├── me/
│   ├── route.ts                                  ← M00.F02.I01 whoami
│   ├── tenants/route.ts                          ← M00.F02.I02 我的租户
│   ├── tenants/[tenantId]/switch/route.ts        ← M00.F02.I03 切换当前租户
│   └── menus/route.ts                            ← M09.F03 我的有效菜单
├── tenants/[tenantId]/
│   ├── users/{,[userId]}/...                     ← M01 CRUD + 角色 + 状态 + 邀请
│   ├── roles/{,[roleId]}/...                     ← M02 CRUD + 权限矩阵 + 菜单
│   ├── api-keys/{,[keyId]/{revoke,rotate}}/...    ← M05.F01 生命周期
│   └── audit-events/{,by-user,retention}/...     ← M06.F01/F02
├── admin/
│   ├── tenants/{,[id]}/route.ts                  ← M00.F01 平台租户 CRUD
│   └── apps/{,[appId]/{,status,menus}/}/...      ← M04.F01 应用 CRUD + M08 菜单
└── apps/[code]/route.ts                          ← 应用公开信息
```

**约束（v0.3.0 hard rules）**：

- ❌ 禁止 MSW handler 走 `app/api/[...msw]/route.ts`（**不可用**——本仓已有真 backend route，无需 MSW 介入）；
- ❌ 禁止在 Server Component 用 TenantProvider（中间件已注入）；

#### 3.2.2 后端基建（4 文件）

| 文件 | 职责 |
|---|---|
| `src/lib/jwt.ts` | `signToken` / `verifyToken`（jose HS256 真签发/验签 + iss/aud/exp）；`decodeJwtPayload` legacy（仅 debug）；`signTestToken`（缺 tenant_id 测错误用）。读 `JWT_SIGNING_KEY`（≥32 字节）、`JWT_ISSUER`、`JWT_AUDIENCE`、`JWT_TTL_SECONDS`。 |
| `src/lib/tenant-guard.ts` | `verifyPathTenant(pathTenantId, authHeader)` async：路径 :tenantId vs JWT `tenant_id` claim 校验，不一致抛 `TenantGuardError(401)`；验签失败（`JwtParseError`）也转 401。**Route Handler 第一行必调**。 |
| `src/lib/oauth-store.ts` | in-memory `Map<string, CodeEntry>` + `Map<string, RefreshEntry>`：code 一次性 `consumeCode`、refresh 旋转 `rotateRefresh`、TTL 懒清理（`OAUTH_CODE_TTL` / `OAUTH_REFRESH_TTL`）。Phase 6 换 Redis。 |
| `src/lib/login-lockout.ts` | 进程内失败计数器（`LOCKOUT_MAX_FAILS` / `LOCKOUT_WINDOW_MIN` / `LOCKOUT_COOLDOWN_MIN`），超阈值 → 429 `ACCOUNT_LOCKED`。Phase 6 持久化。 |

#### 3.2.3 鉴权 / tenant 注入链

```
浏览器 fetch("/api/v1/tenants/<id>/users", { Authorization: "Bearer <jwt>" })
   ↓
Next.js middleware.ts（顶层鉴权 + tenant 上下文）
   ↓
Route Handler（app/api/v1/tenants/[tenantId]/users/route.ts）
   ↓ 第一行：
const claims = await verifyPathTenant(params.tenantId, req.headers.get("authorization"))
   ↓ tenantGuardError → 401 返回
   ↓ 通过 → claims.sub / claims.tenant_id 给业务层
   ↓
业务逻辑：
  db.select().from(users).where(eq(users.tenantId, params.tenantId))
  → drizzle → postgres-js → PG
  → 返回 JSON
```

#### 3.2.4 OAuth 流程（本仓完整实现）

```
1. /api/v1/oauth/authorize?client_id=<appId>&redirect_uri=...&scope=...
   → 校验 appId + 需登录（无 JWT → 重定向到 login）
   → 生成一次性 code → oauthStore.putCode(code, {appId, userId, tenantId, scope, redirectUri})
   → 重定向到 redirect_uri?code=<code>

2. /api/v1/oauth/token (POST { grant_type: "authorization_code", code, ... })
   → oauthStore.consumeCode(code)         ← 一次性（消费即删）
   → signToken({ sub, tenant_id, scope }) ← jose HS256 真签发
   → oauthStore.putRefresh(refresh, ...)  ← refresh token rotation 准备
   → 返回 { access_token, refresh_token, token_type, expires_in }

3. /api/v1/oauth/token (POST { grant_type: "refresh_token", refresh_token })
   → oauthStore.rotateRefresh(oldRt)      ← 旋转（旧删新发由 caller）
   → signToken({ sub, tenant_id, scope })
   → 返回新 access_token + 新 refresh_token
```

### 3.3 DB 层

**职责**：用 Drizzle PG schema 镜像 shared SQL（V001..V007），postgres-js 驱动提供连接池，Route Handler / Server Action 内 select/insert/update/delete。

#### 3.3.1 镜像策略（ADR-0007 强约束）

| 项 | 真源 | 镜像 | 禁止 |
|---|---|---|---|
| 字段名 | `saas-identity-platform-shared/sql/migrations/V*.sql` | `src/db/schema.ts` 1:1 | 改字段名后不跑 `gen-shared.sh` |
| 字段类型 | SQL `UUID` / `TEXT` / `INTEGER` / `JSONB` / `TIMESTAMP` | Drizzle `uuid()` / `text()` / `integer()` / `jsonb()` / `timestamp()` | 用 Drizzle 推导"近似"类型 |
| 索引 | SQL `CREATE INDEX` | Drizzle `index()` / `uniqueIndex()` | Drizzle `generate` 产 SQL（shared 是 SSOT） |
| PG enum | SQL `CREATE TYPE ... AS ENUM` | Drizzle `pgEnum(...)` | 漏注册 enum |

**关键约束**：

- ❌ **禁止用 `drizzle-kit generate` 产 SQL**——shared 是 SSOT，本仓只做 schema 镜像；
- ❌ **禁止修改本文件后手动编辑 `migrations/*.sql`**——改完跑 `bash scripts/gen-shared.sh` 让 shared SQL 重生成 + 本仓 codegen 同步；
- ✅ 镜像偏差通过 fnTest `tests/db.smoke.test.ts` 触发（schema 改了但 SQL 没跟上 → sanity 失败）。

#### 3.3.2 Schema 现状（V001..V007 镜像范围）

```
src/db/schema.ts 顶部 7 个 pgEnum 注册：
  tenant_status          ← active / suspended / archived
  user_status            ← active / invited / suspended / disabled
  membership_status      ← active / invited / removed
  api_key_status         ← active / revoked / expired
  app_status             ← active / disabled
  oauth_grant_type       ← authorization_code / refresh_token / client_credentials / password
  menu_type              ← group / page / action
  menu_status            ← active / disabled
```

表集合（镜像 shared V001..V007）：`tenants` / `users` / `memberships` / `roles` / `permissions` / `role_permissions` / `apps` / `menus` / `role_menu_grants` / `api_keys` / `audit_events` / `audit_retention_policies` / `oauth_clients` 等。

#### 3.3.3 驱动与连接

```ts
// src/db/index.ts（server-only；client component 引入 → webpack build 错）
import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const client = postgres(process.env.DATABASE_URL!, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});
export const db = drizzle(client, { schema });
```

**关键**：

- `import "server-only"` 防止 client component 误引入（webpack 编译期报错）；
- `DATABASE_URL` 缺失即 throw（启动期 fail-fast）；详见 ADR-0009（DB 凭据走 env）+ `memory/springboot-dev-jwt-decoder-gap.md` 风格的安全策略；
- 连接池 `max: 10`（Route Handler 是短生命周期，每次请求从池取一个）。

#### 3.3.4 灌库（sync-db）

```
src/seeds/
├── manifest.json                ← 灌库顺序 + 校验
├── tenants.json                 ← M00.F01 fixtures
├── users.json                   ← M01.F01 fixtures
├── memberships.json
├── roles.json
├── permissions.json
├── role-permissions.json
├── apps.json                    ← M04.F01 fixtures
├── menus.json                   ← M08.F01 fixtures
├── role-menu-grants.json        ← M09 fixtures
├── api-keys.json                ← M05.F01 fixtures
├── audit-events.json            ← M06.F01 fixtures
└── audit-retention-policies.json

# 灌库命令：
npm run sync-db
# → 跑 sql seed loader（顺序按 manifest.json）
# → saas_dev DB 即就绪
```

**与 lab-nextjs 的差异**：lab-nextjs **不**兼后端，但兼**schema emit infra**（`scripts/emit-schema.mjs` 借 pg driver 把 shared SQL 倒成 `generated/schema.sql` / `schema.dbml` / `schema.ts`）。saas-nextjs 没这个职责——它是 schema 的消费者，不是 emit 工具。

---

## 4. 核心流程（数据流）

### 4.1 登录 → JWT → 受保护端点

```
[1] 浏览器 POST /api/v1/auth/login { username, password, tenantCode? }
        ↓ Next.js App Router 进程（同仓）
[2] /api/v1/auth/login/route.ts
        ↓ loginLockout.isLockedOut(username)? → 429 ACCOUNT_LOCKED
        ↓ zod 校验 body
        ↓ db.select(users).where(eq(username), [and(eq(tenantId))])  ← Drizzle PG
        ↓ bcrypt.compare（手写 PBKDF2 占位；Phase 5 接 argon2）
        ↓ 失败 → loginLockout.recordFailure(username) + audit_events.login_failed
        ↓ 成功 → audit_events.login_success
        ↓ signToken({ sub: userId, tenant_id, scope, email })  ← jose HS256
        ↓ oauthStore.putRefresh(refreshToken, {appId, userId, tenantId, scope})
        ↓ 返回 { accessToken, refreshToken, expiresIn, userId, currentTenantId }

[3] 浏览器存 accessToken（cookie 或 memory）

[4] 浏览器 GET /api/v1/me
        Header: Authorization: Bearer <accessToken>
        ↓ middleware.ts（顶层鉴权 / tenant 注入）
        ↓ Route Handler 第一行：await verifyPathTenant(null, authHeader)
        ↓ claimsFromAuthHeader → verifyToken (jose HS256 验签 + iss/aud/exp)
        ↓ TenantGuard 通过（无 :tenantId → 只要 JWT 存在）
        ↓ 业务：db.select(users).where(eq(id, claims.sub))
        ↓ 返回 user

[5] 浏览器 GET /api/v1/tenants/<tenantId>/users
        Header: Authorization: Bearer <accessToken>
        ↓ Route Handler 第一行：await verifyPathTenant(params.tenantId, authHeader)
        ↓ JWT.tenant_id vs path tenantId 不匹配 → 401 TenantGuardError
        ↓ 匹配 → db.select().from(users).where(eq(users.tenantId, params.tenantId))
        ↓ 返回用户列表

[6] refresh：POST /api/v1/auth/refresh { refreshToken }
        ↓ oauthStore.rotateRefresh(refreshToken) → 旧删新发
        ↓ signToken 新 access_token
        ↓ 返回新 { accessToken, refreshToken }
```

### 4.2 OAuth 第三方应用授权

```
[1] 用户点击第三方 app「用 saas-identity-platform 登录」
        ↓ 跳到 /api/v1/oauth/authorize?client_id=<appCode>&redirect_uri=...&scope=...
        ↓ 无 JWT → 重定向到 /login?return_to=...
        ↓ 登录后跳回 authorize

[2] /api/v1/oauth/authorize/route.ts
        ↓ 校验 appCode 存在 + redirect_uri 在白名单
        ↓ 当前用户已登录（claims.sub）
        ↓ oauthStore.putCode(code, {appId, userId, tenantId, scope, redirectUri})  ← 一次性
        ↓ 302 redirect → redirect_uri?code=<code>&state=...

[3] 第三方 app 收到 code → POST /api/v1/oauth/token { grant_type: authorization_code, code }
        ↓ oauthStore.consumeCode(code)  ← 消费即删（防 replay）
        ↓ signToken({ sub, tenant_id, scope })  ← jose HS256
        ↓ oauthStore.putRefresh(refresh, ...)
        ↓ 返回 { access_token, refresh_token, ... }

[4] 第三方 app 用 access_token 调 saas API（如 /api/v1/me/...）
```

### 4.3 登录失败锁定（M03.F01.I02）

```
[1] POST /api/v1/auth/login { username, password（错） }
        ↓ loginLockout.isLockedOut(username) → false
        ↓ 校验失败 → loginLockout.recordFailure(username)  ← count++
        ↓ audit_events.login_failed
        ↓ 返回 401

[2-N] 累计 LOCKOUT_MAX_FAILS（默认 5）次失败（在 LOCKOUT_WINDOW_MIN=15min 窗口内）
        ↓ 第 N+1 次 POST /api/v1/auth/login
        ↓ loginLockout.isLockedOut(username) → true
        ↓ 返回 429 ACCOUNT_LOCKED
        ↓ 进入 LOCKOUT_COOLDOWN_MIN=30min 冷却期

[3] 冷却期过后 → isLockedOut → false → 重新计窗
```

### 4.4 同步链路（跨仓 codegen）

```
[shared] 改 sql/migrations/V00N+1__*.sql 或 tsp/main.tsp
        ↓ git commit + push

[shared] npm run build        ← emit:openapi + tsc --noEmit
        gate: python scripts/gate.py -p saas-identity-platform-shared
        ↓ exit 0

[nextjs-self] bash scripts/gen-shared.sh
        固定三步：
        a) (cd ../shared && npm run emit:openapi)
        b) orval codegen → src/api/endpoints/{endpoints.ts,endpoints.schemas.ts}
        c) cp ../shared/sql/migrations/V*.sql → 本仓 db/migration/（仅参考；schema 镜像走 Drizzle）
        ↓ git commit + push

[父仓] git update-index --add --cacheinfo 160000,<NEW_HASH>,output/saas-identity-platform-nextjs
        chore(submodule): 推进 nextjs-self 指针
        ↓ git push

[suite] python scripts/gate.py --all
        ↓ 15 项目全绿
```

---

## 5. 关键基建（7 文件）

| 文件 | 路径 | 职责 | 备注 |
|---|---|---|---|
| **app-shell.tsx** | `src/components/app/app-shell.tsx` | 顶栏 + 左侧 sidebar + 内容（App Router 版用 `children` prop） | 与 react 仓 1:1 |
| **sidebar-nav.tsx** | `src/components/app/sidebar-nav.tsx` | 分组菜单 + 登出按钮 + BackendBadge footer | v0.4.0 改 |
| **backend-config.ts** | `src/api/backend-config.ts` | env 适配：`getApiBaseUrl` / `getApiMode`（v0.4.0 塌缩到 2 个 getter） | `isMswEnabled` 已删除（ADR-0012 SW 模式废止） |
| **env.ts** | `src/api/env.ts` | 唯一 `process.env.NEXT_PUBLIC_*` 适配点（v0.4.0 新增） | `??` 而非 `\|\|` 处理 prod 空串 |
| **backend-badge.tsx** | `src/components/app/backend-badge.tsx` | 无交互 backend 标签（v0.4.0 替代 BackendSwitcher） | ADR-0014 删除 DropdownMenu + baseUrl 编辑 |
| **crud-dialog.tsx** | `src/components/app/crud-dialog.tsx` | 通用 CRUD Dialog；fields: FieldDef[] 驱动 | 与 react 仓 1:1 |
| **selection-context.tsx** | `src/state/selection-context.tsx` | 多租户/多应用「焦点选中」状态 | lazy initializer 同步 hydrate（CLAUDE.md 禁 `useEffect`） |

**已删除（v0.4.0 — ADR-0014）**：

- ~~`src/state/backend-context.tsx`~~ — React Context；同步 hydrate 单例；useBackend() hook
- ~~`src/components/app/backend-switcher.tsx`~~ — sidebar 底部 DropdownMenu + 自定义 baseUrl 编辑

---

## 6. 决策索引

### 6.1 本仓特有

| ADR | 主题 | 一句话 |
|---|---|---|
| [0008](adr/0008-nextjs-full-stack.md) | saas-nextjs 兼全栈 | App Router 同进程前后端；新增 profile `nextjs-backend.toml`；runtime backend switcher 加第 4 项 `nextjs-self` |

### 6.2 引用父仓 ADR（适用于本仓）

| ADR | 主题 | 本仓落地 |
|---|---|---|
| [0007](../../docs/adr/0007-shared-sql-ssot.md) | shared SQL 是 DB schema SSOT | `src/db/schema.ts` 镜像 V001..V007；禁 `drizzle-kit generate`；改字段必跑 `gen-shared.sh` |
| [0009](../../docs/adr/0009-db-credentials-env.md) | DB 凭据走 env | `DATABASE_URL` 从 env 读；缺失 throw；不写硬编码 |
| [0010](../../docs/adr/0010-aspnetcore-ef-mirrors-sql.md) | EF Migrations 镜像 SQL | （本仓是 Drizzle，类比）schema.ts 镜像 shared SQL |
| [0011](../../docs/adr/0011-lab-vue-m98-whitelist-mirror.md) | 跨仓 I 镜像白名单豁免 | 跨家族 I 镜像时使用 |
| [0012](../../docs/adr/0012-msw-as-http-server.md) | msw 升级为 HTTP 服务 | v0.3.0 Service Worker 模式彻底删除；dev 走 msw-http :5100 |
| 隐含 ADR-0014 | env-driven 单 URL | `getApiBaseUrl` / `getApiMode` 2 getter；删 BackendSwitcher / backend-context |

### 6.3 本仓未来待办（来自 ADR-0008 §Consequences）

| 阶段 | 内容 |
|---|---|
| Phase 6 | oauth-store 换 Redis（TTL 后台清理 + 多进程共享 + 重启恢复）；login-lockout 持久化 |
| 远期 | 真 OIDC 替换 dev echo；`JWT_SIGNING_KEY` 改 env 镜像真 JWKS |

---

## 7. 术语表

| 术语 | 含义 | 详细 |
|---|---|---|
| **全栈形态** | 同仓 Frontend + Backend + DB | ADR-0008；与 react/vue 仓单前端形态不同 |
| **Route Handler** | Next.js App Router 的后端端点 | `app/api/v1/<route>/route.ts` 导出 `POST`/`GET`/`PUT`/`DELETE` async 函数 |
| **Drizzle schema** | TS 写的 PG schema 镜像 | `src/db/schema.ts`；**禁止**用 `drizzle-kit generate` 产 SQL |
| **postgres-js** | postgres 驱动的 Node.js 实现 | 连接池；`max: 10`；Route Handler 短生命周期 |
| **jose HS256** | 对称密钥 JWT 签发库 | `src/lib/jwt.ts`；与 springboot/aspnetcore 同款语义 |
| **TenantGuard** | 路径 :tenantId vs JWT claim 校验 | `src/lib/tenant-guard.ts`；Route Handler 第一行必调 |
| **oauth-store** | in-memory Map（code + refresh） | `src/lib/oauth-store.ts`；Phase 6 换 Redis |
| **login-lockout** | 进程内失败计数器 → 429 | `src/lib/login-lockout.ts`；M03.F01.I02 |
| **env-driven** | env 单 URL 决定后端 | ADR-0014；`getApiBaseUrl()` + `getApiMode()` |
| **MSW HTTP** | 独立 HTTP 服务跑 msw handlers | ADR-0012；saas-msw :5100；本仓 dev fallback |
| **shadcn-ui** | Radix + Tailwind v4 SFC 组件库 | 14 个 SFC `src/components/ui/`；与 react 仓 1:1 |
| **lazy initializer** | `useState(() => readXxx())` 同步 hydrate | tenant / selection / backend Provider 必用；禁 `useEffect` |
| **OAuth 2.0 (本仓实现)** | RFC 6749：authorize/token Route Handler | `src/app/api/v1/oauth/{authorize,token}/route.ts`；grant_type=authorization_code / refresh_token |
| **JWT HS256 (本仓签发)** | RFC 7519 access token，真签发 | `src/lib/jwt.ts::signToken`（jose SignJWT）+ `verifyToken`（jose jwtVerify） |
| **DevJwtDecoder** | 仅 dev path 兜底，prod 走 JWKS | 本仓 jose 真验签无 dev 分支；`JWT_SIGNING_KEY` 缺失即 throw |
| **BASE tree** | 契约仓功能清单（只到 F 级） | 消费仓在 F 镜像后加 I；本仓 M03 多项已上线 |

---

## 8. 与其他仓的关系

### 8.1 上游契约仓

- **shared 仓**：`../saas-identity-platform-shared`
  - `tsp/main.tsp` → `npm run emit:openapi` → `generated/openapi/openapi.yaml`
  - 本仓 `orval codegen` 读 yaml → `src/api/endpoints/{endpoints.ts,endpoints.schemas.ts}`
  - `sql/migrations/V*.sql` → 本仓 `src/db/schema.ts` 镜像（**禁 drizzle-kit generate**）
- **shared 不引**：禁从 `@saas/identity-platform-shared` import TS 客户端；禁 webpack alias / tsconfig paths

### 8.2 下游 mock 仓（dev 调试用）

- **msw 仓**：`../saas-identity-platform-msw`（`@saas/identity-platform-msw`）
  - 独立 HTTP server :5100（`src/server.ts::Express + @mswjs/http-middleware + cors`）
  - 本仓 dev 没设 `NEXT_PUBLIC_API_BASE_URL` 时 fallback 到 `http://localhost:5100`
  - fixtures 与本仓 `src/seeds/` 是两套独立的种子数据（msw handlers in-memory vs sync-db 灌 PG）

### 8.3 横向对照仓

- **react 仓** / **vue 仓**：纯前端；调本仓 backend 时需把 `NEXT_PUBLIC_API_BASE_URL=http://localhost:5101`（CORS allowlist 必须含 5101）
- **springboot 仓** / **aspnetcore 仓**：同契约的另一后端实现；三家 HS256 JWT 互认（共享 `JWT_SIGNING_KEY`）

### 8.4 父仓

- 父仓 `xr-code-suite/` 持有本仓 gitlink（160000）；`git update-index --add --cacheinfo 160000,<HASH>,output/saas-identity-platform-nextjs`
- 父仓 `scripts/gate.py -p saas-identity-platform-nextjs` 跑 L0..L5

---

## 附录 A：本仓与其他 nextjs 仓的差异

| 仓 | 角色 | 关键差异 |
|---|---|---|
| `saas-identity-platform-nextjs` | **全栈**（Frontend + Backend + DB） | `src/db/`、`src/lib/{jwt,tenant-guard,oauth-store,login-lockout}.ts`、`app/api/v1/**/route.ts`；profile = `nextjs-backend.toml` |
| `lab-management-system-nextjs` | **前端 + schema emit infra** | `src/db/` 是空的；`scripts/emit-schema.mjs` 借 pg driver 把 shared SQL 倒成 `generated/schema.{sql,dbml,ts}`（被 `lab-shared/scripts/sync-db.mjs` 借链） |

**schema emit infra 的存在意义**：lab-nextjs 不兼后端，但它是 sync-db 工具链上 pg driver 的「现成宿主」（避免在 shared 仓装 pg devDep）。

## 附录 B：与父仓 docs/ARCHITECTURE.md 的关系

- **父仓 ARCHITECTURE.md** 描述 *suite 级* 拓扑（14 子仓家族、SSOT、端口、CORS、env、门禁链）；
- **本仓 ARCHITECTURE.md** 描述 *本仓内部* 结构（前后端三大层、4 个后端基建、DB 镜像策略、4 个核心流程）；
- 父仓 §4.3 nextjs 仓的特殊性 + ADR-0008 描述全栈决策的 *动机*；本仓 §1 + §3 描述全栈决策 *落地形态*；
- 父仓 §7 决策索引列所有 12+ ADR；本仓 §6 只列本仓相关（[ADR-0008](adr/0008-nextjs-full-stack.md) + 引用父仓 5 份）。

## 附录 C：相关约定 / 决策 / 文档

- 本仓入口：[CLAUDE.md](../CLAUDE.md)（技术栈 + 禁止事项 + 指向别处）
- 本仓全栈决策：[docs/adr/0008-nextjs-full-stack.md](adr/0008-nextjs-full-stack.md)
- 本仓编码细则：[docs/conventions/](conventions/)（`nextjs-full-stack.md` / `nextjs-env-driven.md` / ...）
- 本仓迁移指南：[docs/saas-identity-platform-v0.3.0-shadcn-ui-migration.md](saas-identity-platform-v0.3.0-shadcn-ui-migration.md)
- shared 仓契约：[../saas-identity-platform-shared/](../saas-identity-platform-shared/)
- msw 仓 mock：[../saas-identity-platform-msw/](../saas-identity-platform-msw/)
- 父仓架构总览：[../../docs/ARCHITECTURE.md](../../docs/ARCHITECTURE.md)
- 父仓 ADR 总索引：[../../docs/adr/](../../docs/adr/)
- 跨仓经验教训：[../../memory/](../../memory/)（非入仓，~/.claude/...）

## 附录 D：典型陷阱

| 陷阱 | 后果 | 解法 |
|---|---|---|
| 改字段名后没跑 `gen-shared.sh` | drizzle schema 与 shared SQL 不同步；L4 集成测试红 | 改完先跑 `bash scripts/gen-shared.sh`，commit 一起推 |
| Route Handler 忘调 `verifyPathTenant` | tenant 越权读 | Route Handler 第一行 `await verifyPathTenant(params.tenantId, req.headers.get("authorization"))` |
| `JWT_SIGNING_KEY` < 32 字节 | 启动 throw；生产报错 | deploy 脚本自举随机密钥并写到 VPS env-file |
| client component 引入 `src/db/` | webpack build 错（server-only） | 必须 Route Handler / Server Action / Server Component 引入 |
| 用 `drizzle-kit generate` 产 SQL | 污染 shared SQL SSOT | 禁；改完跑 `gen-shared.sh` 让 shared SQL 重生成 |
| `baseURL` 含 `/api/v1` 前缀 | path 前缀重复 404 | `getApiBaseUrl()` 是 root URL；path 自带 prefix |
| `useState(emptySession) + useEffect(loadSession)` | tenant / selection / backend 三 Provider SSR 不一致 | 必用 lazy initializer `useState(() => readXxx())` |
| Server Component 挂 `data-fn` | 客户端测试挂不到 fn-ID | 必须 client 组件挂 `data-fn` |
| 用 `window.confirm` / `alert` | 与 shadcn Dialog 风格不一致；CLAUDE.md 禁止 | 用 `confirm-dialog.tsx` |