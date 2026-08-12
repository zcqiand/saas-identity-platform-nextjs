# saas-identity-platform-nextjs

> Next.js 15 + App Router + shadcn/ui。catch-all route handler 走 msw setupServer。

## 1. 这是什么

saas-identity-platform 的 Next.js 前端。路由段 `t/[tenantId]/` 与 TypeSpec 路径模板对齐。

## 2. 禁止事项

- 禁止 Server Component 内挂 `data-fn`（必须 client 组件）
- 禁止直接 fetch

## 3. 指向别处

- shared 仓：`../saas-identity-platform-shared`
- function-tree：`docs/functions/function-tree.md`

## 4. 工作循环

1. 改 page（`src/app/(dashboard)/t/[tenantId]/<module>/page.tsx`）
2. `npm run gen:shared`
3. `python scripts/gate.py -p saas-identity-platform-nextjs`
