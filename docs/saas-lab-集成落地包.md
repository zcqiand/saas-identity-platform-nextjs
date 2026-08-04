# SaaS × lab 身份集成落地包

> 前提决策（已定）：**1 个 lab 机构 ⟷ 1 个 saas 租户（1:1）**。lab 只面对自己那一个
> `tenantId`，不引入租户切换器 / TenantContext。角色、权限、菜单一律按 `tenantId` 取；
> 菜单树按 `appId` 取。client_id = 应用编码（app-lab 的 `code` = `lab-management`）。
>
> 约定：以下代码块沿用 saas 现有风格（单引号 / 无分号）。所有改动集中在 `msw/`，
> lab 端仅 1 处（第 5 节）。

---

## 0. 关键前提：现有 `app-lab` 菜单已漂移

`msw/db.ts` 里的 `LAB_LAB_MENUS` 是"参考 router.tsx"手写的，已与 lab 现网菜单脱节：
路径写成 `test-parameters`（实际 `inspection-parameters`）、混入 `report-categories` /
`report-templates` 两个幽灵路由、漏掉 `report-names` / `param-interfaces` /
`inspection-calculation-rules` / `inspection-specialties` / `inspection-objects` 五项、
且没有 lab 的 5 个分组。第 2 节用**校正版整体替换** `LAB_LAB_MENUS`。

lab 现网菜单（来源 `src/app/layouts/Layout.tsx` + `src/app/router.tsx`）：

| 分组 | 菜单 | path | permission |
|---|---|---|---|
| （顶级） | 仪表盘 | `dashboard` | —（不鉴权） |
| 系统 | 机构信息 | `org-info` | `user:read` |
| 系统 | 角色管理 | `settings/roles` | `role:read` |
| 系统 | 用户管理 | `settings/users` | `user:read` |
| 业务 | 合同管理 | `contracts` | `project:read` |
| 业务 | 接样管理 | `receipts` | `sample:read` |
| 业务 | 任务安排 | `task-assignment` | `report:write` |
| 业务 | 数据录入 | `data-entry` | `report:write` |
| 业务 | 报告审核 | `report-review` | `report:read` |
| 业务 | 报告批准 | `report-approve` | `report:issue` |
| 业务 | 报告发放 | `report-issue` | `report:read` |
| 业务 | 报告归档 | `report-archive` | `report:read` |
| 主数据 | 报告名称 | `report-names` | `user:read` |
| 主数据 | 参数界面 | `param-interfaces` | `user:read` |
| 主数据 | 型号维护 | `models` | `user:read` |
| 主数据 | 规格维护 | `specifications` | `user:read` |
| 主数据 | 等级维护 | `grades` | `user:read` |
| 主数据 | 牌号维护 | `brands` | `user:read` |
| 主数据 | 计算规则 | `inspection-calculation-rules` | `user:read` |
| 主数据 | 技术要求 | `inspection-technical-requirements` | `user:read` |
| 检测 | 检测专项 | `inspection-specialties` | `user:read` |
| 检测 | 检测项目 | `inspection-objects` | `user:read` |
| 检测 | 检测参数 | `inspection-parameters` | `user:read` |
| 检测 | 检测标准 | `inspection-standards` | `user:read` |
| 统计 | 统计汇总 | `summary` | `report:read` |

---

## 1. 类型改动（3 处，各加字段）

### 1.1 `msw/jwt.ts` — JwtPayload 加 `tenantId` / `appId`

```diff
 export interface JwtPayload {
   sub: string
   username: string
   /** 当前组织 ID（SaaS 多组织） */
   orgId: string
+  /** 当前租户 ID（= lab 机构，1:1） */
+  tenantId: string
+  /** 登录来源应用 ID */
+  appId: string
   roles: string[]
   permissions: string[]
   exp: number
 }
```

### 1.2 `src/types/app.ts` + `msw/db.ts` — 菜单加可选 `permission`

菜单显隐沿用 lab 的权限码轴（不改 lab 逻辑），故给菜单项挂一个权限码。

```diff
 export interface MenuItem {
   id: string
   name: string
   path: string
   icon?: string
   sort: number
   appId: string
   parentId: string | null
   enabled: boolean
+  /** 显隐所需权限码；缺省表示不鉴权 */
+  permission?: string
   createdAt: string
   updatedAt: string
 }
```

`msw/db.ts` 的 `MockMenu` 同步加 `permission?: string`（字段位置随意）。

---

## 2. 校正后的 `LAB_LAB_MENUS`（整体替换）

替换 `msw/db.ts` 中现有的 `LAB_LAB_MENUS` 常量。5 个分组作为父节点，
`dashboard` 作为顶级叶子，全部 `appId: 'app-lab'`。

```ts
// 建筑工程实验室管理系统菜单——与 lab 现网 Layout/router 对齐（勿手改，改 lab 后同步）
const T = '2026-01-01T00:00:00Z'
const LAB_LAB_MENUS: MockMenu[] = [
  // 顶级
  { id: 'm-lab-dash', name: '仪表盘', path: 'dashboard', appId: 'app-lab', parentId: null, sort: 1, enabled: true, createdAt: T, updatedAt: T },

  // 分组父节点
  { id: 'grp-sys',    name: '系统',   path: '', appId: 'app-lab', parentId: null, sort: 10, enabled: true, createdAt: T, updatedAt: T },
  { id: 'grp-biz',    name: '业务',   path: '', appId: 'app-lab', parentId: null, sort: 20, enabled: true, createdAt: T, updatedAt: T },
  { id: 'grp-master', name: '主数据', path: '', appId: 'app-lab', parentId: null, sort: 30, enabled: true, createdAt: T, updatedAt: T },
  { id: 'grp-insp',   name: '检测',   path: '', appId: 'app-lab', parentId: null, sort: 40, enabled: true, createdAt: T, updatedAt: T },
  { id: 'grp-stat',   name: '统计',   path: '', appId: 'app-lab', parentId: null, sort: 50, enabled: true, createdAt: T, updatedAt: T },

  // 系统
  { id: 'm-org-info', name: '机构信息', path: 'org-info',       appId: 'app-lab', parentId: 'grp-sys', sort: 1, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },
  { id: 'm-roles',    name: '角色管理', path: 'settings/roles', appId: 'app-lab', parentId: 'grp-sys', sort: 2, enabled: true, permission: 'role:read', createdAt: T, updatedAt: T },
  { id: 'm-users',    name: '用户管理', path: 'settings/users', appId: 'app-lab', parentId: 'grp-sys', sort: 3, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },

  // 业务
  { id: 'm-contracts',    name: '合同管理', path: 'contracts',       appId: 'app-lab', parentId: 'grp-biz', sort: 1, enabled: true, permission: 'project:read', createdAt: T, updatedAt: T },
  { id: 'm-receipts',     name: '接样管理', path: 'receipts',        appId: 'app-lab', parentId: 'grp-biz', sort: 2, enabled: true, permission: 'sample:read',  createdAt: T, updatedAt: T },
  { id: 'm-task',         name: '任务安排', path: 'task-assignment', appId: 'app-lab', parentId: 'grp-biz', sort: 3, enabled: true, permission: 'report:write', createdAt: T, updatedAt: T },
  { id: 'm-entry',        name: '数据录入', path: 'data-entry',      appId: 'app-lab', parentId: 'grp-biz', sort: 4, enabled: true, permission: 'report:write', createdAt: T, updatedAt: T },
  { id: 'm-review',       name: '报告审核', path: 'report-review',   appId: 'app-lab', parentId: 'grp-biz', sort: 5, enabled: true, permission: 'report:read',  createdAt: T, updatedAt: T },
  { id: 'm-approve',      name: '报告批准', path: 'report-approve',  appId: 'app-lab', parentId: 'grp-biz', sort: 6, enabled: true, permission: 'report:issue', createdAt: T, updatedAt: T },
  { id: 'm-issue',        name: '报告发放', path: 'report-issue',    appId: 'app-lab', parentId: 'grp-biz', sort: 7, enabled: true, permission: 'report:read',  createdAt: T, updatedAt: T },
  { id: 'm-archive',      name: '报告归档', path: 'report-archive',  appId: 'app-lab', parentId: 'grp-biz', sort: 8, enabled: true, permission: 'report:read',  createdAt: T, updatedAt: T },

  // 主数据
  { id: 'm-report-names', name: '报告名称', path: 'report-names',                    appId: 'app-lab', parentId: 'grp-master', sort: 1, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },
  { id: 'm-param-ifs',    name: '参数界面', path: 'param-interfaces',                appId: 'app-lab', parentId: 'grp-master', sort: 2, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },
  { id: 'm-models',       name: '型号维护', path: 'models',                          appId: 'app-lab', parentId: 'grp-master', sort: 3, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },
  { id: 'm-specs',        name: '规格维护', path: 'specifications',                  appId: 'app-lab', parentId: 'grp-master', sort: 4, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },
  { id: 'm-grades',       name: '等级维护', path: 'grades',                          appId: 'app-lab', parentId: 'grp-master', sort: 5, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },
  { id: 'm-brands',       name: '牌号维护', path: 'brands',                          appId: 'app-lab', parentId: 'grp-master', sort: 6, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },
  { id: 'm-calc-rules',   name: '计算规则', path: 'inspection-calculation-rules',    appId: 'app-lab', parentId: 'grp-master', sort: 7, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },
  { id: 'm-tech-req',     name: '技术要求', path: 'inspection-technical-requirements', appId: 'app-lab', parentId: 'grp-master', sort: 8, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },

  // 检测
  { id: 'm-insp-spec',    name: '检测专项', path: 'inspection-specialties', appId: 'app-lab', parentId: 'grp-insp', sort: 1, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },
  { id: 'm-insp-obj',     name: '检测项目', path: 'inspection-objects',     appId: 'app-lab', parentId: 'grp-insp', sort: 2, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },
  { id: 'm-insp-param',   name: '检测参数', path: 'inspection-parameters',  appId: 'app-lab', parentId: 'grp-insp', sort: 3, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },
  { id: 'm-insp-std',     name: '检测标准', path: 'inspection-standards',   appId: 'app-lab', parentId: 'grp-insp', sort: 4, enabled: true, permission: 'user:read', createdAt: T, updatedAt: T },

  // 统计
  { id: 'm-summary',      name: '统计汇总', path: 'summary', appId: 'app-lab', parentId: 'grp-stat', sort: 1, enabled: true, permission: 'report:read', createdAt: T, updatedAt: T },
]
```

> 说明：分组父节点 `path: ''` 只作层级容器、不导航；lab 端渲染时父节点仅决定是否展开
> （见第 5 节）。父节点不挂 permission——某组下所有子项都无权时该组自然隐藏。

---

## 3. 租户 / 根组织 / 角色种子（机构 = 租户 1:1）

### 3.1 lab 租户（加进 `DEFAULT_TENANTS`）

```ts
{
  id: 'tenant-lab',
  name: '示例建筑工程检测实验室',       // = lab 机构名（OrgInfo.orgName）
  theme: { primary: '#2563eb', sidebar: '#1e293b', logoText: 'LAB' },
  config: { features: ['sso', 'rbac', 'audit'], maxUsers: 50 },
}
```

### 3.2 根组织节点（承载 user.orgId，暂无业务含义）

在 `DEFAULT_ORG_TREE` 的 `org-root.children` 追加：

```ts
{ id: 'org-lab-root', name: '示例建筑工程检测实验室' }
```

### 3.3 租户作用域的角色目录（lab 权限码，非 saas 内置词表）

saas 内置 `ALL_PERMISSIONS` 只有 `user:* / org / audit`，装不下 lab 业务权限。
新增一张"按租户的角色表"，键 = tenantId：

```ts
// lab 租户的角色目录（tenant-scoped）
const LAB_ROLES = [
  {
    id: 'role-lab-admin',
    name: 'labadmin',
    permissions: [
      'user:read', 'user:create', 'user:update', 'user:delete',
      'role:read', 'role:write',
      'project:read', 'project:write',
      'sample:read', 'sample:write',
      'report:read', 'report:write', 'report:issue',
      'org:read', 'audit:read',
    ],
    menuPermissions: [],
  },
  {
    id: 'role-lab-tech',
    name: 'technician',
    // 与 lab README 对齐：project:read / sample:* / report:*
    permissions: [
      'project:read',
      'sample:read', 'sample:write',
      'report:read', 'report:write', 'report:issue',
    ],
    menuPermissions: [],
  },
]

// tenantId -> 角色目录
const TENANT_ROLES: Record<string, typeof LAB_ROLES> = {
  'tenant-lab': LAB_ROLES,
}
export function rolesByTenant(tenantId: string) {
  return TENANT_ROLES[tenantId] ?? []
}
```

> technician 无 `user:read` / `role:read` → 系统组的用户/角色管理菜单对其自动隐藏，
> 与 lab 现网行为一致。

---

## 4. 三个 handler 改动（`msw/handlers.ts`）

### 4.1 `/sso/authorize` — 校验 client_id 属于已注册应用

```diff
 http.get('*/sso/authorize', ({ request }) => {
   const url = new URL(request.url)
   const clientId = url.searchParams.get('client_id')
   const redirectUri = url.searchParams.get('redirect_uri')
   const state = url.searchParams.get('state')
   if (!clientId || !redirectUri) {
     return HttpResponse.json({ message: '缺少 client_id 或 redirect_uri' }, { status: 400 })
   }
+  // client_id = 应用编码（App.code）；未注册则拒绝
+  const app = listApps().find((a) => a.code === clientId && a.enabled)
+  if (!app) {
+    return HttpResponse.json({ message: `未知或未启用的 client_id: ${clientId}` }, { status: 400 })
+  }
   const code = `mock-auth-code-${Date.now()}`
-  const callbackUrl = `${redirectUri}?code=${code}&state=${state ?? ''}`
+  // 把 client_id 透传进回调，供换 token 阶段定位应用/租户
+  const callbackUrl = `${redirectUri}?code=${code}&client_id=${clientId}&state=${state ?? ''}`
   return new HttpResponse(null, { status: 302, headers: { Location: callbackUrl } })
 }),
```
（`listApps` 已在 db.ts 导出；记得在 handlers 顶部 import。）

### 4.2 `/auth/oauth/callback` — 按应用解析租户/机构，签发带 tenantId/appId 的 token

```diff
 http.post('*/auth/oauth/callback', async ({ request }) => {
-  const body = (await request.json()) as { code: string; provider?: string }
+  const body = (await request.json()) as { code: string; clientId?: string; provider?: string }
   if (!body.code || body.code === 'bad-code') {
     return HttpResponse.json({ message: '无效授权码' }, { status: 401 })
   }
+  // 定位应用；本 mock 里一个应用对应一个 lab 租户
+  const app = listApps().find((a) => a.code === body.clientId)
+  if (!app) {
+    return HttpResponse.json({ message: '无效 client_id' }, { status: 401 })
+  }
+  // 应用 -> 租户映射（生产由 user 身份解析；mock 固定到 lab 租户）
+  const APP_TENANT: Record<string, string> = { 'app-lab': 'tenant-lab' }
+  const tenantId = APP_TENANT[app.id] ?? 'tenant-lab'
+  const orgId = 'org-lab-root'
+  const labAdmin = rolesByTenant(tenantId).find((r) => r.name === 'labadmin')
-  const token = signJwt({
-    sub: 'u-001',
-    username: 'admin@acme',
-    orgId: 'org-acme',
-    roles: ['admin'],
-    permissions: ['user:read', 'user:create', 'user:delete', 'org:read', 'org:write'],
-  })
+  const token = signJwt({
+    sub: 'u-lab-admin',
+    username: 'labadmin',
+    orgId,
+    tenantId,
+    appId: app.id,
+    roles: [labAdmin?.name ?? 'labadmin'],
+    permissions: labAdmin?.permissions ?? [],
+  })
   return HttpResponse.json({
     token,
-    user: { id: 'u-001', username: 'admin@acme', displayName: 'SaaS 管理员', orgId: 'org-acme' },
+    user: { id: 'u-lab-admin', username: 'labadmin', displayName: '实验室管理员', orgId, tenantId },
   })
 }),
```

### 4.3 `/auth/permissions` — 改按 token 里的 tenantId 取角色

```diff
 http.get('*/auth/permissions', ({ request }) => {
   const auth = request.headers.get('Authorization')
   if (!auth || !auth.startsWith('Bearer ')) {
     return HttpResponse.json({ message: '未授权' }, { status: 401 })
   }
-  const url = new URL(request.url)
-  const orgId = url.searchParams.get('orgId') ?? 'org-acme'
-  const acmeRoles: Role[] = [ /* ...写死... */ ]
-  const globexRoles: Role[] = [ /* ...写死... */ ]
-  const roles = orgId === 'org-globex' ? globexRoles : acmeRoles
-  const permissions = roles.flatMap((r) => r.permissions)
+  const payload = verifyJwt(auth.slice(7))
+  if (!payload) {
+    return HttpResponse.json({ message: 'token 无效或已过期' }, { status: 401 })
+  }
+  // 作用域从 orgId 改为 tenantId：同一实验室共享角色目录
+  const roles = rolesByTenant(payload.tenantId)
+  // 当前用户实际权限 = 其所属角色权限的并集（与 token.permissions 一致）
+  const mine = roles.filter((r) => payload.roles.includes(r.name))
+  const permissions = Array.from(new Set(mine.flatMap((r) => r.permissions)))
   return HttpResponse.json({ roles, permissions })
 }),
```
（`verifyJwt`、`rolesByTenant` 记得 import。）

---

## 5. lab 端唯一改动：导航从写死改为拉取

`src/app/layouts/Layout.tsx`：现在菜单是硬编码数组 + `user.permissions.includes(item.permission)`
过滤。改为登录后拉 `/menus?appId=lab-management`（clientId=应用 code），把返回的
`MenuItem[]` 按 `parentId` 组树，**过滤逻辑原样保留**（`!item.permission || user.permissions.includes(item.permission)`）。
`usePermission` / `HasPermission` 的按钮级鉴权一行不改。

伪代码：

```ts
const { data: menus } = useMenus('lab-management')   // GET /menus?appId=...
const visible = menus.filter((m) => !m.permission || user?.permissions.includes(m.permission))
const tree = buildTree(visible)   // 按 parentId 分组，父节点无可见子项则整组隐藏
```

登录链路：`Login` 改为跳 `/sso/authorize?client_id=lab-management&redirect_uri=<lab回调>`
→ `SsoCallback` 拿 `code` + `client_id` POST 到 `/auth/oauth/callback` → 存 token →
拉 `/auth/me`、`/auth/permissions`、`/menus`。saas 已带 `SsoCallback.tsx` + `ssoRedirect.ts` 可参考。

---

## 6. 验证清单

- [ ] `client_id=lab-management` 能过 `/sso/authorize`；换成未注册 code 返回 400。
- [ ] callback 返回的 token 解出 `tenantId='tenant-lab'`、`appId='app-lab'`。
- [ ] `GET /menus?appId=app-lab` 返回 25 条（含 5 组父节点 + dashboard），路径全部命中 lab 路由。
- [ ] labadmin 看到全部菜单；technician 隐藏"用户管理/角色管理"（缺 user:read/role:read）。
- [ ] `/auth/permissions` 不再读 orgId 查询参数，改由 token.tenantId 决定。
- [ ] lab 端 `usePermission` / `HasPermission` 无改动、按钮级鉴权照旧。
- [ ] 新增机构 = saas 加 1 租户 + 1 根 org + 1 admin 用户，lab 侧零改动。

---

## 尚未覆盖（按需再排）

- 权限词表：lab 业务码（sample/report/project…）目前只存在于 `LAB_ROLES` 种子里，
  saas 的 RBAC 编辑界面 `ALL_PERMISSIONS` 仍是内置词表；若要在 saas 管理端可视化编辑
  lab 角色，需把 lab 词表并入或做成"按应用的权限字典"。
- `menuPermissions` 轴：本方案用权限码做菜单显隐，未用 saas 的 `Role.menuPermissions`
  （menuId→actions）。两者二选一，别同时维护。
- 审计：lab 的登录/操作若要进 saas 审计日志，需在 lab 关键动作上打 `POST /audit`。
