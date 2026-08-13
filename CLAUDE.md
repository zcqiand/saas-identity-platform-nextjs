# saas-identity-platform-nextjs

> Next.js 15 + App Router + TS 5.7 + shadcn-ui + Tailwind v4。v0.2.0 自己 orval，v0.3.0 全面 shadcn-ui 化（左侧菜单 + 右侧内容），v0.4.0 扩展为全栈（Frontend + Backend Route Handler + PostgreSQL via Drizzle）。见 ADR-0007/0008/0009/0010。

## 1. 这是什么

saas-identity-platform 的 Next.js **全栈**应用（已落地 v0.2.0 迁移 + v0.3.0 shadcn-ui 迁移 + v0.4.0 full-stack 化）。

- **UI 框架**：shadcn-ui（Radix UI primitive + Tailwind v4 + 14 个 SFC 组件 `src/components/ui/`，与 React 仓 1:1 对应）
- **MSW / API client / 后端切换 / 校验 / v0.4.0 后端 + DB**：见 `docs/conventions/nextjs-*.md`（`nextjs-full-stack.md` 是本次新增）

## 2. 禁止事项（v0.3.0 hard rules）

- ❌ 禁止从 `@saas/identity-platform-shared` import TS 客户端
- ❌ 禁止给 next.config.js 加 webpack alias `@saas/shared` / tsconfig paths `@saas/*`
- ❌ 禁止把后端模式写到 `.env` / `.env.example` / `next.config.js` proxy
- ❌ 禁止给按钮加图标（`Plus` / `Trash2` / `Power` / `ShieldCheck` / `Save` / `X` / `LogIn` / `Download`）
- ❌ 禁止用 `useState(emptySession) + useEffect(loadSession)` —— tenant / selection / backend 三个 Provider 必须 lazy initializer 同步 hydrate
- ❌ 禁止手写 fetch + 字符串 URL
- ❌ 禁止 `vi.mock('axios')` 来 mock API
- ❌ 禁止 axios 升 1.19
- ❌ 禁止在 shared 仓把 `@tanstack/react-query` 列在 `dependencies`
- ❌ 禁止 demo 密码（`demo123` / `DEMO_PASSWORD` 等）出现在 UI / 注释 / 测试断言
- ❌ 禁止 Server Component 内挂 `data-fn`（必须 client 组件）
- ❌ 禁止在组件里直接 fetch
- ❌ 禁止 MSW handler 走 `app/api/[...msw]/route.ts`（不可用）
- ❌ 禁止在 Server Component 用 TenantProvider
- ❌ 禁止在 page 中用 `<button style="padding: 6px 12px">` 之类内联样式
- ❌ 禁止手写 `<table>` / `<thead>` / `<tbody>` 长列表
- ❌ 禁止写 `window.confirm` / `alert(...)`
- ❌ 禁止自定义 `<select>` 风格的下拉
- ❌ 禁止未在 function-tree 登记的 fnId 挂在 `data-fn` 上

## 3. 7 个核心基建文件

| 文件 | 职责 |
| --- | --- |
| `src/components/app/app-shell.tsx` | 顶栏 + 左侧 sidebar + 内容（App Router 版用 `children` prop） |
| `src/components/app/sidebar-nav.tsx` | 分组菜单 + 登出按钮 + BackendSwitcher footer |
| `src/api/backend-config.ts` | 模块级单例；7 个 getter/setter；hydrate/snapshot 双向桥 |
| `src/state/backend-context.tsx` | React Context；同步 hydrate 单例；useBackend() hook |
| `src/components/app/backend-switcher.tsx` | sidebar 底部 DropdownMenu + 自定义 baseUrl 编辑 |
| `src/components/app/crud-dialog.tsx` | 通用 CRUD Dialog；fields: FieldDef[] 驱动 |
| `src/state/selection-context.tsx` | 多租户/多应用「焦点选中」状态 |

## 4. 指向别处

- shared 仓：`../saas-identity-platform-shared`（只读 `generated/openapi/openapi.yaml`）
- msw 仓：`../saas-identity-platform-msw`（`@saas/identity-platform-msw`）
- 迁移指南（v0.2.0）：react 仓 `docs/saas-identity-platform-v0.2.0-migration.md`（nextjs 必读 §7）
- 迁移指南（v0.3.0 shadcn-ui）：`docs/saas-identity-platform-v0.3.0-shadcn-ui-migration.md`
- function-tree：`docs/functions/function-tree.md`

## 5. 工作循环

1. 改 UI（`app/<route>/page.tsx`）
2. 改了 shared？→ `npm run gen:shared`（orval 读 yaml 重新生成本仓 `src/api/endpoints/`）
3. `python scripts/gate.py -p saas-identity-platform-nextjs`
