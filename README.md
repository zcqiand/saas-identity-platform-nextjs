# SaaS 多租户多应用身份平台 · Next.js 全栈

SaaS 身份平台的 Next.js 全栈应用（App Router）—— 前端 UI + OAuth 2.0 IdP Route Handlers + PostgreSQL。

本仓为《Next.js 从入门到项目实战》案例二「SaaS 多租户身份平台」（第 35-40 章，另第 41 章测试策略跨仓取材本仓、第 42 章概念收官）的案例仓，书稿代码块挂本仓 source= 锚点（章节映射见下）。

本仓同时作为《Vue从入门到项目实践》（亚马逊电子书）案例二的可运行配套后端工程（真链路 :5101）——该书正文不挂本仓 source= 锚点，其前端代码块的 **source of truth** 为姊妹仓 saas-identity-platform-vue。

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

### 《Next.js 从入门到项目实战》（主绑定）

- 书稿定位：案例二「SaaS 多租户身份平台」，第 35-40 章正文代码块挂本仓 source= 锚点；第 41 章「测试策略」跨仓取材本仓 vitest 体系；第 42 章为概念收官章（无摘码）
- 锚点基线：正文 source= 锚点文件以本仓工作区现行结构为准，均已核实存在

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

### 《Vue从入门到项目实践》（亚马逊电子书）

- 书稿基线：书稿正文不挂本仓 source= 锚点（本仓为真链路配套后端 :5101，未按章冻结书稿 tag）；最新 tag `v0.7.69-20260926`
- 书稿定位：案例二「SaaS 多租户身份平台」配套后端，服务第 39-42 章真链路联调，并作为 lab 家族 SSO 身份源

| 章 | 主题 | 对应源文件 |
| :--- | :--- | :--- |
| 39 | 案例二：SaaS 架构与多租户 | — |
| 40 | 案例二：统一认证与 RBAC | — |
| 41 | 案例二：成员全生命周期 | — |
| 42 | 全栈项目总结与部署 | — |

## 快速链接

- [CLAUDE.md](CLAUDE.md) — 入口、门禁、禁止事项
- [系统架构.md](docs/ARCHITECTURE.md) — 结构 / 边界 / 数据流 / 决策
- [功能规格.md](docs/functions/function-tree.md) — 功能名称、描述与验收标准
- [未来开发计划](PLAN.md) — 待办与迭代方向
- [更新日志](CHANGELOG.md) — 版本变更记录
