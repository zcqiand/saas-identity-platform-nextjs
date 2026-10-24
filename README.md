# SaaS 多租户多应用身份平台 · Next.js 全栈

SaaS 身份平台的 Next.js 全栈应用（App Router）—— 前端 UI + OAuth 2.0 IdP Route Handlers + PostgreSQL。

本仓为《Next.js 从入门到项目实战》案例二「SaaS 多租户身份平台」（第 35-40 章，另第 41 章测试策略跨仓取材本仓、第 42 章概念收官）的案例仓，书稿代码块挂本仓 source= 锚点（章节映射见下）。

## 快速开始

```bash
npm install        # 安装依赖
npm run gen:shared # shared emit:openapi + 本仓 orval → src/api/endpoints/
npm test           # 全量测试（无 Key / 无 Docker / 无网可跑）
npm run dev        # 本地开发
npm run build      # 生产构建
```

## 功能特性

- **前端**：shadcn-ui（Radix primitive + Tailwind v4）+ AppShell + SidebarNav
- **后端**：OAuth 2.0 IdP Route Handlers（v0.7.x，修 prod lab-nextjs 502）+ `/api/v1/*` CORS middleware
- **DB**：PostgreSQL via Drizzle（node-pg-migrate + sync-db --incremental）
- 作为 lab 家族的 SSO 身份源（lab-management client 白名单）

## 技术栈

| 技术 | 版本 |
| :--- | :--- |
| Next.js | ^15.1.0 |
| React | ^19.0.0 |
| Drizzle ORM | ^0.36.4 |
| postgres / pg | ^3.4.5 / ^8.23.0 |
| node-pg-migrate | ^7.6.1 |
| jose | ^5.10.0 |
| orval（axios client） | ^7.5.0 |
| TypeScript | ^5.7.0 |
| Vitest | ^2.1.0 |

> 依赖版本与 `version-lock.json` 的 `version_lock` 一致，不引入 lock 外的库。

## 配套书籍及章节映射

> 同一案例仓后续接入其他书籍时，在此节下新增书籍小节。

### 书一《Next.js 从入门到项目实战》

- 书稿定位：案例二「SaaS 多租户身份平台」，第 35-40 章正文代码块挂本仓 source= 锚点；第 41 章「测试策略」跨仓取材本仓 vitest 体系；第 42 章为概念收官章（无摘码）
- 书稿绑定 tag：`v0.7.69-20260926`（src/ 与当前 HEAD 一致；正文 source= 锚点文件均在该 tag 内）

| 章 | 书稿章节 | 主要取材 |
| :--- | :--- | :--- |
| 35 | 案例立项：多租户身份平台的数据建模 | src/db/schema.ts、scripts/pull-schema.sh |
| 36 | 密码登录与租户守卫 | api/v1/auth/login、login-lockout、tenant-guard、require-auth |
| 37 | 成员与角色：租户内的身份管理 | tenants/[tenantId]/{members,roles}、tenant-switcher |
| 38 | 权限矩阵与树形菜单：动态菜单下发 | roles/[roleId]/menus、tree-table、api/v1/me/menus |
| 39 | OAuth 应用管理：客户端注册与订阅 | admin/clients、tenants/[tenantId]/applications |
| 40 | SSO 授权码流：令牌签发与动态菜单 | api/v1/oauth/{authorize,token}、oauth-store |
| 41 | 测试策略（跨仓部分） | vitest.config、tests/integration/oauth-authorize |
| 42 | 全栈收官（概念章，无摘码） | — |

### 书二《Claude Code 从入门到项目实践》（卷四）

- 书稿定位：xr-know-002，第 34、35、36、37、38、39、40 章正文代码块挂本仓 `source=` 锚点
- 配套版本：`v0.7.69-20260926`（registry 冻结 tag，代码以此为准）

| 章 | 章题 | 对应源文件 |
| :--- | :--- | :--- |
| 34 | 安全基线与权限管控 | `src/app/layout.tsx` |
| 35 | 团队规范与自动化执法 | `src/app/tenants/page.tsx` |
| 36 | 契约驱动与 API 协作 | `src/app/tenants/[tenantId]/members/page.tsx` + `src/app/tenants/[tenantId]/roles/page.tsx` |
| 37 | 演进重构与敏感护栏 | `src/app/api/v1/oauth/token/route.ts` + `src/lib/jwt.ts` + `src/lib/oauth-store.ts` |
| 38 | 并行开发与子代理流水线 | `src/components/app/app-shell.tsx` + `src/app/api/v1/oauth/token/route.ts` |
| 39 | 无人值守与批量自动化 | — |
| 40 | CI/CD 门禁与发布流水线 | `src/app/admin/clients/page.tsx` |

### 书三《Codex 从入门到项目实践》

- 书稿定位：xr-know-003，第 35、36、37、38、39、40、41 章正文代码块挂本仓 `source=` 锚点
- 配套版本：`v0.7.69-20260926`（registry 冻结 tag，代码以此为准）

| 章 | 章题 | 对应源文件 |
| :--- | :--- | :--- |
| 35 | 第二产品的边界与约束 | `src/app/login/page.tsx` |
| 36 | 第一个租户的诞生 | `src/components/tenant-switcher.tsx` + `src/app/tenants/[tenantId]/members/page.tsx` |
| 37 | 角色授权的产品化 | `src/app/tenants/[tenantId]/roles/[roleId]/menus/page.tsx` |
| 38 | 应用订阅与自助开通 | `src/app/tenants/[tenantId]/applications/page.tsx` |
| 39 | 平台治理与批量运维 | — |
| 40 | 定时值守与运营周报 | `src/app/admin/clients/[clientId]/menus/page.tsx` |
| 41 | 发布节奏与运营复盘 | `src/app/tenants/[tenantId]/applications/page.tsx` |

### 书四《Pi 从入门到项目实践》

- 书稿定位：xr-know-017，第 20、21、22、23、24、25、26、27、36 章正文代码块挂本仓 `source=` 锚点
- 配套版本：`v0.7.70-20261004`（registry 冻结 tag，代码以此为准）

| 章 | 章题 | 对应源文件 |
| :--- | :--- | :--- |
| 20 | 勘察 saas 仓 | — |
| 21 | 改契约、生成客户端 | — |
| 22 | drizzle 模式变更 | — |
| 23 | 服务端实现 | — |
| 24 | react-query 接入 | `src/app/tenants/[tenantId]/members/page.tsx` |
| 25 | 测试与交叉审查防线 | `src/app/tenants/[tenantId]/members/page.tsx` |
| 26 | 部署上线 | — |
| 27 | saas 仓收官 | — |
| 36 | 双仓复盘与工作流 | — |

### 书五《OpenCode 从入门到项目实践》（卷五）

- 书稿定位：xr-know-018，第 34、35、36、37、38、39、40、41、42 章正文代码块挂本仓 `source=` 锚点
- 配套版本：`v0.7.69-20260926`（registry 冻结 tag，代码以此为准）

| 章 | 章题 | 对应源文件 |
| :--- | :--- | :--- |
| 34 | 项目二启动 | `src/app/layout.tsx` + `src/app/api/v1/oauth/authorize/route.ts` |
| 35 | 租户管理 | `src/app/tenants/page.tsx` |
| 36 | 认证与登录态 | `src/app/login/page.tsx` + `src/app/tenants/[tenantId]/members/page.tsx` + `src/components/app/app-shell.tsx` + `src/app/api/v1/oauth/token/route.ts` + `src/lib/jwt.ts` + `src/lib/oauth-store.ts` |
| 37 | 角色授权与权限矩阵 | `src/app/tenants/[tenantId]/roles/page.tsx` + `src/app/tenants/[tenantId]/roles/[roleId]/menus/page.tsx` + `src/app/tenants/[tenantId]/members/page.tsx` |
| 38 | 并行与协作 | — |
| 39 | 性能与安全加固 | `src/app/api/v1/oauth/token/route.ts` + `src/lib/jwt.ts` + `src/lib/oauth-store.ts` |
| 40 | 生产部署与可观测 | — |
| 41 | 三端协同进阶 | — |
| 42 | 全书收官 | — |
## 快速链接

- [CLAUDE.md](CLAUDE.md) — 入口、门禁、禁止事项
- [系统架构.md](docs/ARCHITECTURE.md) — 结构 / 边界 / 数据流 / 决策
- [功能规格.md](docs/functions/function-tree.md) — 功能名称、描述与验收标准
- [未来开发计划](PLAN.md) — 待办与迭代方向
- [更新日志](CHANGELOG.md) — 版本变更记录
