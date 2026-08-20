# saas-identity-platform-v0.3.0-shadcn-ui-migration

> Next.js 端 v0.2.0（orval 自生成）+ v0.3.0 迁移：全面 shadcn-ui 化 + 左侧菜单布局。

## 背景

v0.2.0 完成了 nextjs 端 orval 自治（不再 `file:` 依赖 shared 仓 TS 产物），但 UI 仍停留在「手写 markup + 极简 CSS」阶段：

- 9 个 page 全部用 `<button style="padding: 6px 12px">` 风格的硬编码内联样式
- 没有 UI 库，没有 Tailwind，没有 design token
- App Router 各页面间没有共享布局，sidebar 不存在
- 视觉与 React 仓（已落地 shadcn-ui + Tailwind v4 + AppShell）严重不对齐

v0.3.0 一次性把这 4 件事做完：UI 库 + 布局 + 全 page 改写 + 文档同步。

## 决策

### 1. UI 库选型：shadcn-ui（1:1 对齐 React 仓）
- React 仓已用 [shadcn-ui](https://ui.shadcn.com/)（Radix UI + Tailwind v4 + cva + cn() + lucide-react + sonner）
- Next.js 端直接复用：同样的 shadcn-ui 组件（React Server Component 友好）
- 组件 API 命名同步（button / card / dialog / …）；迁移 React 仓样板代码直接复用

### 2. 布局：左侧菜单 + 右侧内容，App Router 风格
- 通过 `app/layout.tsx` 包 `<Providers><RequireAuth>{children}</RequireAuth></Providers>`
- `RequireAuth` 是 client component，按登录态决定：
  - 未登录 → 跳 `/login`
  - 已登录 → 用 `<AppShell>` 包裹 children（左侧 sidebar + 顶部 breadcrumb + 右侧内容）
- `/login` 路由独立不走 AppShell
- App Router 用 `children` prop 替代 React Router `<Outlet />`

### 3. 路由：保留 Next.js App Router 原生结构
- 路由组：`app/tenants/page.tsx`、`app/tenants/[tenantId]/users/page.tsx` 等
- `params` 在 Next.js 15 是 `Promise<{...}>`，client 组件用 `const { tenantId } = use(params)` 解包
- 由 `RequireAuth` 统一守卫；测试用 `vi.mock("react", ...)` 把 `use` 替换为 sync unwrap

### 4. 范围：全面重构（9 page + 3 组件 + AppShell + 路由）
- 9 page 全部用 shadcn-ui 组件（保留 `data-fn` 锚点 1:1）
- 3 组件迁移（~~backend-switcher~~ → v0.4.0 删除 / crud-dialog / tenant-switcher）+ 8 个新镜像（page-header / data-table / empty-state / confirm-dialog / field / pagination-bar / status-badge / sidebar-nav）+ AppShell
- 14 个 shadcn-ui 组件（button / card / dialog / input / textarea / label / select / checkbox / dropdown-menu / separator / badge / skeleton / table / alert-dialog + sonner）

> 2026-08-20 增注（ADR-0014）：backend-switcher 在 v0.4.0 已删除；改用 `src/components/app/backend-badge.tsx`（无交互 mode 标签）+ env 配置。

## 组件映射表（React → Next.js）

| React 仓 | Next.js 仓 | 适配点 |
| --- | --- | --- |
| `@/components/ui/button` | `@/components/ui/button` | 同 |
| `@/components/ui/card` | `@/components/ui/card` | 同 |
| `@/components/ui/dialog` | `@/components/ui/dialog` | 同 |
| `@/components/ui/select` | `@/components/ui/select` | 同 |
| 等等 | 同 | 全套 1:1 |
| `@/components/app/app-shell` | `@/components/app/app-shell` | `useLocation/useNavigate` → `usePathname/useRouter`；`<Outlet>` → `children` |
| `@/components/app/sidebar-nav` | `@/components/app/sidebar-nav` | `NavLink` → `next/link` + `usePathname` 比较 |
| `@/components/app/crud-dialog` | `@/components/app/crud-dialog` | 同 |
| `@/components/app/tenant-switcher` | `@/components/app/tenant-switcher` | `useNavigate` → `useRouter` |
| `@/components/app/backend-switcher` | `@/components/app/backend-switcher` | 同 |
| `@/components/app/empty-state` | `@/components/app/empty-state` | 同 |
| `@/components/app/page-header` | `@/components/app/page-header` | 同 |
| `@/components/app/data-table` | `@/components/app/data-table` | 同 |
| `@/components/app/confirm-dialog` | `@/components/app/confirm-dialog` | 同 |
| `@/components/app/field` | `@/components/app/field` | 同 |
| `@/components/app/pagination-bar` | `@/components/app/pagination-bar` | 同 |
| `@/components/app/status-badge` | `@/components/app/status-badge` | 同 |
| `@/state/selection-context` | `@/state/selection-context` | 同（多租户/多应用「焦点选中」状态） |

## 9 page 镜像对照

| Next.js 路径 | React 镜像 | 关键 fnId |
| --- | --- | --- |
| `app/login/page.tsx` | `LoginPage.tsx` | M03.F01.I01 |
| `app/tenants/page.tsx` | `TenantListPage.tsx` | M00.F01.I02 / I04 / I05 |
| `app/tenants/[tenantId]/users/page.tsx` | `UserListPage.tsx` | M01.F01.I02 / I04 / I05 + M01.F02.I01 |
| `app/tenants/[tenantId]/roles/page.tsx` | `RoleListPage.tsx` | M02.F01.I02 / I04 / I05 + M02.F02.I01 + M09.F01.I01 |
| `app/tenants/[tenantId]/roles/[roleId]/menus/page.tsx` | `RoleMenuGrantPage.tsx` | M09.F02.I02 / I03 |
| `app/admin/apps/page.tsx` | `AppListPage.tsx` | M08.F01.I02 / I04 / I05 + M04.F02.I06 |
| `app/admin/apps/[appId]/menus/page.tsx` | `MenuTreePage.tsx` | M08.F01.I02 / I04 / I05 + M08.F02.I07 |
| `app/tenants/[tenantId]/api-keys/page.tsx` | `ApiKeyListPage.tsx` | M05.F01.I02 / I03 / I04 |
| `app/tenants/[tenantId]/audit/page.tsx` | `AuditListPage.tsx` | M06.F01.I03 |

## 关键不变量

- ✅ `data-fn` 锚点 1:1 保留（42 子项 + 8 sidebar + 1 登出）
- ✅ 测试 selector 1:1 保留（6 文件 `data-fn` 选择器，markup 改写不破测试）
- ✅ 文案 1:1 保留（"新建租户" / "编辑" / "删除" / "创建 Key" / "轮换" / "吊销" / "导出 CSV" / "邀请用户" / "新建角色" / "新建应用" / "新建菜单" / "分配角色" / "权限矩阵" / "菜单授权" / "保存 (n)"）
- ✅ 业务逻辑（query key / mutation / invalidation）保持
- ✅ state store 引用（useTenant / useBackend / useSelection）保持

## 关键坑（本次迁移遇到）

1. **Next.js 15 `params` 是 Promise<T>** — client component 用 `use(params)` 解包；测试用 `vi.mock("react", ...)` 替换 `use` 为 sync unwrap
2. **App Router 嵌套路由 ≠ React Router `<Outlet />`** — 用 `children` prop 代替；layout 用 `RequireAuth` 守卫 + `<AppShell>{children}</AppShell>` 包裹
3. **`react-router-dom` 不兼容** — sidebar-nav 改用 `next/link` + `usePathname` 判定 active
4. **Server Component 不能挂 `data-fn`** — 所有 page.tsx 顶部加 `"use client"`；side effect（useState/useQuery）必须在 client
5. **MSW v2 + Next.js** — `next.config.js` 加 `transpilePackages: ["@saas/identity-platform-msw"]`（同 React 仓）
6. **NestJS 14 `transpilePackages` warnings** — 仅 info 级别，不阻断 gate
7. **`react-hooks/rules-of-hooks` 在 selection-context.tsx 触发** — 用 `useEffect` 替换条件 `useState`，避免嵌套 hook 调用

## 验收

- L0 typecheck: 0 错
- L1 ESLint: 0 错
- L2 vitest: 6 文件 6 测试全绿
- L3 gate: 全绿
- L4 trace: 86 个功能条目，0 软告警
- 手动 UI 验证（用户验收）：
  - `/login` 渲染居中卡片登录页
  - 登录后跳转 `/tenants`，左侧深色 sidebar + 顶部面包屑 + 右侧内容
  - 切换 4 个 sidebar group
  - 9 个 page 链接切换正常，fnId 锚点保留
  - 登出按钮 (`M03.F03.I05`) 工作
  - 后端切换器 3 模式切换正常
  - DevTools → Application → Service Workers: `mockServiceWorker.js` 已注册

## 不在本次范围

- function-tree 全部「规划」翻成「已上线」
- `crud-dialog.tsx` 的 `crud.cancel` / `crud.submit` 改标准 fnId
- `backend-switcher.tsx` 挂错 `M03.F01.I01` 修正
- `package.json` 加 `msw:init` 脚本（防 mockServiceWorker.js 再丢）
- `npm run dev` 手动验证（用户验收）

## 工期

- Phase 1 依赖 + 配置：~5 min
- Phase 2 复制 25 个组件 + AppShell 改造：~5 min
- Phase 3 9 page 改写：~25 min
- Phase 4 layout.tsx + 守卫 + 路由：~5 min
- Phase 5 文档同步：~5 min
- 验证与 L0-L5 修复：~10 min

合计 ~55 min
