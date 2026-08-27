# CLAUDE.md — SaaS身份平台Next.js全栈

> 书稿配套仓 + harness 门禁仓双身份。入口，不是手册。L0 门强制上限 60 行。
> 本仓为《（书稿信息待补）》案例（待补）的可运行配套工程，是书稿代码块的 **source of truth**。

## 1. 项目定位

SaaS 多租户多应用身份平台的 Next.js **全栈**应用：前端（shadcn-ui 14 组件 + AppShell）
+ 后端（OAuth 2.0 IdP Route Handlers + PostgreSQL via Drizzle）。演进史 v0.2.0 orval →
v0.3.0 shadcn-ui → v0.4.0 full-stack → v0.7.x IdP Route Handlers。见 ADR-0007/0008/0009/0010/0014。

## 2. 铁律

- **TDD**：先写失败测试 → 确认红 → 实现 → 确认绿 → commit
- **版本钉死**：依赖与 `version-lock.json` 的 `version_lock` 一致；不引入 lock 外的库
- **tag 即放行**：全量回归绿后打 `v<MAJOR>.<MINOR>.<PATCH>-<YYYYMMDD>`（如 `v0.7.46-20260826`）
- **mock-friendly**：安装 + 测试在无 Key、无 Docker、无网下全绿
- **功能清单是锚点**：改 function-tree 走 `/tree-change`；同 commit；废弃只改状态，编号不复用
- 禁止从 shared import TS 客户端 / 加 `@saas/*` alias
- 禁止运行时切后端 / 恢复 BackendProvider 系（ADR-0014 已废弃）；env 写 `.env.example`
- 禁止组件内直接 fetch（走 orval 具名函数）；禁止 `vi.mock('axios')`；禁止 axios 升 1.19
- 禁止给按钮加图标；禁止 demo 密码出现在 UI / 注释 / 断言
- 禁止 Server Component 内挂 `data-fn` / 用 TenantProvider / 内联样式 / 手写 `<table>` / `window.confirm`
- 禁止 MSW handler 走 `app/api/[...msw]/route.ts`（不可用）
- 细则（7 个核心基建文件、迁移指南）→ `docs/conventions/` 与 `docs/nextjs-*.md`

## 3. 技术栈与版本（钉死于 version-lock.json）

Next.js 15 App Router + TS 5.7 + shadcn-ui + Tailwind v4 + Drizzle + postgres + jose + orval(axios)。明细见 `version-lock.json`。

门禁命令见 `.harness/stack.json`。**不要改它来让门变松。**

## 4. 验收

- suite 根目录跑 `python scripts/gate.py -p saas-identity-platform-nextjs`
- 改了 shared → `npm run gen:shared`

## 5. 指向别处

- shared 仓 → `../saas-identity-platform-shared`（只读 OpenAPI）；msw 仓 → `../saas-identity-platform-msw`
- 迁移指南 → `docs/saas-identity-platform-v0.{2.0,3.0}-*.md`
- 决策 → `docs/adr/`；细则 → `docs/conventions/`；待办 → `PLAN.md`；版本 → `CHANGELOG.md`

## 6. 工作循环

1. 改 UI（`app/<route>/page.tsx`）或 API Route Handler；最小改动
2. gate exit 1 修；exit 2 停下问人
3. `/handoff` 更新 `.state/session.json`
