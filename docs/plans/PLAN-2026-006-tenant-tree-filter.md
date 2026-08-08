# PLAN-2026-006 — 5 个管理页租户树过滤

需求文档：`docs/requirements/REQ-2026-006-tenant-tree-filter.md`
依赖：drizzle 0.30 + 5 个 list store 已在 master；**不安装新依赖**（REQ §3 + 项目无 pinia）
技术栈：Next.js 15 App Router + TS + drizzle + next/navigation（原生 router 状态）+ shadcn/ui

> **校正注记（2026-08-08）**：原 plan 误从 saas-identity-platform-vue 仓复制「pinia」措辞，nextjs 仓无 pinia 且 pinia 不能驱动 React 重渲染。改用 React hook + next/navigation（URL 是 single source of truth）。文件落 `src/lib/tenant-filter-store.ts`（matches 现有 32 个 *-store.ts 命名约定），不建新目录。

```
T1 (tenant-filter-store)
  └→ T2 (tenant-tree-sidebar)
       └→ T3 (sub-layout for 5 pages)
            ├→ T4 (departments page)
            ├→ T5 (users page)
            ├→ T6 (positions page)
            ├→ T7 (user-groups page)
            └→ T8 (roles page)
```

T1-T3 是基础设施（被 5 个页面共用），必串行；T4-T8 是 5 个页面各自的挂 data-fn + list query 加 where，可并发（但 commits 顺序无关，5 个独立 commit）。

---

## 任务 T1: tenant-filter-store（pinia + URL 双向同步）

- **fn-ID**：M02.F01.I10（先挂此条作主 ID，4 个 list 改查询时各挂自己的）
- **文件**：`src/stores/tenant-filter-store.ts`（新建） + `tests/stores/tenant-filter-store.test.ts`（新建）
- **测试先行**：写一个 vitest 测 `setTenant('acme')` 后 `selectedTenantId === 'acme'` + `searchParams.get('tenant') === 'acme'`（用 `useRoute` mock），跑红（pinia 装上 + setup test setup.ts 引用）；再 `clear()` 验证 URL 去掉 tenant 参数
- **入口**：无 UI（store 而非组件）
- **验证**：`npx vitest run tests/stores/tenant-filter-store.test.ts` exit 0；然后 `npm run typecheck` exit 0

## 任务 T2: tenant-tree-sidebar 组件

- **fn-ID**：复用 M01.F01.I08 租户布局（已上线）作为组件 data-fn
- **文件**：`src/components/app/tenant-tree-sidebar.tsx`（新建） + `tests/components/tenant-tree-sidebar.test.tsx`（新建）
- **测试先行**：写一个 vitest 测 `render(<TenantTreeSidebar />)` 后 ① 看到 2 个 tenant 节点（acme + tenant-lab）② 点击 node 触发 `useTenantFilter().setTenant('acme')` ③ 节点旁显示「N 部门/N 用户/N 角色」汇总（mock fetch 计数）
- **入口**：组件根挂 `data-testid="tenant-tree-sidebar" data-fn="M01.F01.I08"`
- **验证**：`npx vitest run tests/components/tenant-tree-sidebar.test.tsx` exit 0

## 任务 T3: 共用 sub-layout for 5 pages

- **fn-ID**：M01.F01.I08（layout 根容器）
- **文件**：`src/app/(protected)/_tenant-scoped/layout.tsx`（新建） + `src/app/(protected)/departments/page.tsx`（改）/ `src/app/(protected)/users/page.tsx`（改）等 5 个 page
- **测试先行**：5 个 page 的子 page.tsx 测试 — mount 后断言 ① 出现 `data-testid="tenant-tree-sidebar"` ② 出现原 list 的 `data-testid`（depts-table / users-table 等）
- **入口**：sub-layout 根挂 `data-testid="tenant-scoped-layout"`
- **验证**：`npx vitest run tests/features/departments-list.test.tsx tests/features/users-list.test.tsx` exit 0

## 任务 T4: departments page 挂 data-fn + list 改造

- **fn-ID**：M02.F01.I10
- **文件**：`src/lib/department-store.ts`（listDepartments 加 tenantId?: string） + `src/app/(protected)/departments/departments-client.tsx`（读 store 拿 tenantId，调 listDepartments(tenantId)）
- **测试先行**：改 `tests/features/departments-list.test.tsx` — mock `useTenantFilter().selectedTenantId === 'acme'`，断言 fetch 调用带了 tenantId='acme'；再加一个 fnTest M02.F01.I10 验证 data-fn 在 root
- **入口**：departments-client 根挂 `data-testid="departments-page" data-fn="M02.F01.I10"`
- **验证**：`npx vitest run tests/features/departments-list.test.tsx` exit 0

## 任务 T5: users page 挂 data-fn + list 改造

- **fn-ID**：M02.F02.I10
- **文件**：`src/lib/user-store.ts`（listUsers 接受 tenantId） + `src/app/(protected)/users/users-client.tsx`
- **测试先行**：同 T4，替换 fixture 为 users；加 fnTest M02.F02.I10
- **入口**：users-client 根挂 `data-testid="users-page" data-fn="M02.F02.I10"`
- **验证**：`npx vitest run tests/features/users-list.test.tsx` exit 0

## 任务 T6: positions page 挂 data-fn + list 改造

- **fn-ID**：M02.F03.I06
- **文件**：`src/lib/position-store.ts`（listPositions 加 tenantId） + `src/app/(protected)/positions/positions-client.tsx`
- **测试先行**：同 T4，positions；加 fnTest M02.F03.I06
- **入口**：positions-client 根挂 `data-testid="positions-page" data-fn="M02.F03.I06"`
- **验证**：`npx vitest run tests/features/positions-list.test.tsx` exit 0

## 任务 T7: user-groups page 挂 data-fn + list 改造

- **fn-ID**：M03.F03.I06
- **文件**：`src/lib/user-group-store.ts`（listUserGroups 加 tenantId） + `src/app/(protected)/user-groups/user-groups-client.tsx`
- **测试先行**：同 T4，user-groups；加 fnTest M03.F03.I06
- **入口**：user-groups-client 根挂 `data-testid="user-groups-page" data-fn="M03.F03.I06"`
- **验证**：`npx vitest run tests/features/user-groups-list.test.tsx` exit 0

## 任务 T8: roles page 挂 data-fn + list 改造

- **fn-ID**：M03.F01.I11
- **文件**：`src/lib/role-store.ts`（listRoles 加 tenantId） + `src/app/(protected)/roles/roles-client.tsx`
- **测试先行**：同 T4，roles；加 fnTest M03.F01.I11
- **入口**：roles-client 根挂 `data-testid="roles-page" data-fn="M03.F01.I11"`
- **验证**：`npx vitest run tests/features/roles-list.test.tsx` exit 0

---

## 完成定义（DoD）

- [ ] 8 个任务全部 ✓
- [ ] `npm run typecheck` exit 0
- [ ] `npx eslint --max-warnings=0 src tests` exit 0
- [ ] `npx vitest run` PG 可达时 0 fail；test 计数 80 → 85（+5 个 fnTest）
- [ ] 5 个管理页人工验：左栏租户树、点租户 URL 同步、跨 5 页保留、F5 丢错
- [ ] `python scripts/gate.py -p saas-identity-platform-nextjs` 全绿
- [ ] 5 个 commit（一个任务一个）+ 1 个基础设施合 commit

## 不要做

- 不要新建 pinia plugin 或 refactor tenant-store（pinia 装好但无 plugin/Tenancy 概念）
- 不要新建 schema 或 migration（tenants 表 + 各表 tenantId 已有）
- 不要碰 audit-logs / permission-groups / api-keys / apps / settings（用户只点 5 个管理页）
- 不要修改 src/db/generated/db.pg.ts（gitignore，跑 sync:db-pg）
- 不要给 audit-logs 加租户树（用户明确说只 5 个管理页）
