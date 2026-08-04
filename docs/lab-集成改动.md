# saas 侧 · lab 身份集成改动（已落地并验证）

> 前提：**1 个 lab 机构 ⟷ 1 个 saas 租户（1:1）**。lab 机构对应租户根组织
> `org-lab-root`，沿用 saas ch40 既有的"按 orgId 返回权限集"机制，**全部改动向后兼容，
> 不改 acme/globex 行为**。验证：`tsc --noEmit` ✅ / `vitest run` 399 passed·4 skipped（62 文件）✅ /
> `npm run build` ✅。

## 改了什么

| 文件 | 改动 | 兼容性 |
|---|---|---|
| `msw/jwt.ts` | `JwtPayload` 增 `tenantId?` / `appId?`（**可选**） | 旧 signJwt 调用不受影响 |
| `src/types/app.ts` | `MenuItem` 增 `permission?`（可选） | 纯新增字段 |
| `msw/db.ts` | `MockMenu` 增 `permission?` | 纯新增字段 |
| `msw/db.ts` | **重建 `LAB_LAB_MENUS`** 与 lab 现网对齐（25 项，5 组父节点 + 权限码） | 替换已漂移的旧种子 |
| `msw/db.ts` | `DEFAULT_TENANTS` 增 `tenant-lab`；`DEFAULT_ORG_TREE` 增 `org-lab-root` | 追加，不改既有 |
| `msw/db.ts` | 新增 `LAB_ROLES` + `rolesByTenant()`（导出）；lab 业务权限码 | 纯新增 |
| `msw/handlers.ts` | `/auth/oauth/callback`：`clientId==='lab-management'` 分支签发 lab 租户 token | 无 clientId 时走 acme（旧行为） |
| `msw/handlers.ts` | `/auth/permissions`：`orgId==='org-lab-root'` 分支返回 lab 角色/权限 | acme/globex 不变 |

## 修正的历史漂移

旧 `LAB_LAB_MENUS`（"参考 router.tsx" 手写）已与 lab 现网脱节，本次一并修正：

- 路径纠正：`test-parameters`→`inspection-parameters`、`test-standards`→`inspection-standards`、
  `technical-requirements`→`inspection-technical-requirements`
- 删除幽灵路由：`report-categories`、`report-templates`（lab 无此路由）
- 补齐遗漏：`report-names`、`param-interfaces`、`inspection-calculation-rules`、
  `inspection-specialties`、`inspection-objects`
- 名称纠正：收样管理→接样管理、统计报表→统计汇总
- 恢复 lab 的 5 组结构：系统 / 业务 / 主数据 / 检测 / 统计

## lab 端如何对接（契约）

1. `GET /sso/authorize?client_id=lab-management&redirect_uri=<lab回调>` → 302 带 code。
2. `POST /auth/oauth/callback { code, clientId: 'lab-management' }` → `{ token, user }`；
   token claim 含 `tenantId=tenant-lab`、`appId=app-lab`、lab 业务权限码。
3. `GET /auth/permissions?orgId=org-lab-root`（带 Bearer）→ `{ roles, permissions }`，
   即 lab 的 labadmin / technician 角色与权限集。
4. `GET /menus?appId=app-lab` → 校正后的 lab 菜单树（含 `permission` 字段，供 lab 显隐）。

## 刻意未做（与 saas 既有 chapter 冲突，留给作者定夺）

- **未强制 `/sso/authorize` 校验 client_id**：saas 自带测试用 `saas-demo-client`（非注册应用编码），
  强校验会打挂 ch40 测试。lab 只需正常传 redirect_uri。
- **`/auth/permissions` 仍走 orgId**：未切成 tenantId，因为 saas ch40 的教学点就是"按组织返回权限"，
  且 1:1 下 orgId=org-lab-root 已等价于 tenantId=tenant-lab。token 里的 `tenantId` 作为元数据备用。
- lab 业务权限码目前只存在于 `LAB_ROLES` 种子；若要在 saas 管理端可视化编辑 lab 角色，
  需把 lab 词表并入 RBAC 的 `ALL_PERMISSIONS`（做成"按应用的权限字典"）。
