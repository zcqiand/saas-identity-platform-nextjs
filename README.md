# SaaS 多租户多应用身份平台 · Next.js 全栈

SaaS 身份平台的 Next.js 全栈应用（App Router）—— 前端 UI + OAuth 2.0 IdP Route Handlers + PostgreSQL。

本仓为《（书稿信息待补）》案例（待补）的可运行配套工程，是书稿代码块的 **source of truth**。

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
- 作为 lab 家族的 SSO 身份源（lab-mgmt client 白名单）

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

| 章 | 主题 | 对应源文件 |
| :--- | :--- | :--- |
| （待补） | | |

## 快速链接

- [CLAUDE.md](CLAUDE.md) — 入口、门禁、禁止事项
- [系统架构.md](docs/ARCHITECTURE.md) — 结构 / 边界 / 数据流 / 决策
- [功能规格.md](docs/functions/function-tree.md) — 功能名称、描述与验收标准
- [未来开发计划](PLAN.md) — 待办与迭代方向
- [更新日志](CHANGELOG.md) — 版本变更记录
