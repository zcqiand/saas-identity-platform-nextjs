/**
 * M03.F02 身份集成 - lab 业务数据种子
 *
 * saas 仓给 lab 仓的 OAuth 委托用的"数据契约"：租户 / 组织 / 角色 / 业务权限 / 菜单。
 * 与 saas-React 仓 msw/db.ts 独立设计 —— saas-React 仓是 mock 本地演示，saas-nextjs 仓
 * 是真 SQLite，菜单项按 lab-nextjs 当前已实现的子集裁剪（避免出现 lab 仓没实现的路由
 * 让侧边栏渲染出死链）。
 *
 * 关键决策：
 *   - 1 个 lab 机构 = 1 个 saas 租户（1:1），与 saas-React 仓的"lab 集成"决策一致
 *   - 业务权限码与 lab-nextjs/src/lib/permissions.ts 的 PERMISSIONS 常量对齐（不引入新码）
 *   - 菜单项用 string id（与 saas-React 仓 msw 一致；saas-nextjs admin /api/menus 用 numeric id 是另一路）
 */

/** 租户 — 与 saas-React 仓 msw/db.ts 的 tenant-lab 字段同义 */
export const LAB_TENANT = {
  id: "tenant-lab",
  name: "示例建筑工程检测实验室",
  theme: "#2563eb",
  logoText: "LAB",
} as const;

/** 组织根（挂在 tenant-lab 下） */
export const LAB_ORG_ROOT = {
  id: "org-lab-root",
  name: "示例建筑工程检测实验室",
  tenantId: LAB_TENANT.id,
} as const;

/** lab 业务权限码全集（与 lab-nextjs/src/lib/permissions.ts 对齐） */
export const LAB_PERMISSION_CODES = [
  "project:read",
  "project:write",
  "sample:read",
  "sample:write",
  "report:read",
  "report:write",
  "report:issue",
  "org:read",
  "audit:read",
] as const;

/** lab 用户（mock 演示；prod 走真实 user 表） */
export interface LabUser {
  id: string;
  username: string;
  displayName: string;
  orgId: string;
  tenantId: string;
  roleId: string;
}

export const LAB_USERS: readonly LabUser[] = [
  {
    id: "u-lab-admin",
    username: "labadmin",
    displayName: "实验室管理员",
    orgId: LAB_ORG_ROOT.id,
    tenantId: LAB_TENANT.id,
    roleId: "role-lab-admin",
  },
  {
    id: "u-lab-tech",
    username: "technician",
    displayName: "检测员",
    orgId: LAB_ORG_ROOT.id,
    tenantId: LAB_TENANT.id,
    roleId: "role-lab-tech",
  },
] as const;

/** lab 角色（mock 演示用：1 个 admin 拿到全部业务权限，1 个 tech 拿到 sample/report 范围） */
export interface LabRole {
  id: string;
  name: string;
  description: string;
  permissions: readonly string[];
}

export const LAB_ROLES: readonly LabRole[] = [
  {
    id: "role-lab-admin",
    name: "labadmin",
    description: "实验室管理员",
    permissions: LAB_PERMISSION_CODES,
  },
  {
    id: "role-lab-tech",
    name: "technician",
    description: "检测员",
    permissions: ["sample:read", "sample:write", "report:read", "report:write"],
  },
] as const;

/** lab 菜单 — 5 组父节点 + 19 子项
 *  - 仅收录 lab-nextjs 当前已实现的路由（避免死链）
 *  - path 字段与 lab-nextjs/src/app/(protected)/** 路由对齐
 *  - permission 字段为显隐所需权限码（缺省 = 始终可见，例如 dashboard）
 */
export interface LabMenu {
  id: string;
  name: string;
  path: string;
  appId: string;
  parentId: string | null;
  sort: number;
  enabled: boolean;
  permission?: string;
}

export const APP_LAB_ID = "app-lab";

export const LAB_MENUS: readonly LabMenu[] = [
  // 分组父节点（5 组）
  {
    id: "grp-sys",
    name: "系统管理",
    path: "",
    appId: APP_LAB_ID,
    parentId: null,
    sort: 1,
    enabled: true,
  },
  {
    id: "grp-biz",
    name: "试验过程管理",
    path: "",
    appId: APP_LAB_ID,
    parentId: null,
    sort: 2,
    enabled: true,
  },
  {
    id: "grp-master",
    name: "基础数据",
    path: "",
    appId: APP_LAB_ID,
    parentId: null,
    sort: 3,
    enabled: true,
  },
  {
    id: "grp-stat",
    name: "数据统计",
    path: "",
    appId: APP_LAB_ID,
    parentId: null,
    sort: 4,
    enabled: true,
  },

  // 系统管理
  {
    id: "m-lab-dash",
    name: "仪表盘",
    path: "/dashboard",
    appId: APP_LAB_ID,
    parentId: null,
    sort: 0,
    enabled: true,
  },
  {
    id: "m-org-info",
    name: "机构信息",
    path: "/org-info",
    appId: APP_LAB_ID,
    parentId: "grp-sys",
    sort: 1,
    enabled: true,
    permission: "org:read",
  },
  {
    id: "m-users",
    name: "用户管理",
    path: "/users",
    appId: APP_LAB_ID,
    parentId: "grp-sys",
    sort: 2,
    enabled: true,
    permission: "user:read",
  },
  {
    id: "m-roles",
    name: "角色管理",
    path: "/roles",
    appId: APP_LAB_ID,
    parentId: "grp-sys",
    sort: 3,
    enabled: true,
    permission: "role:read",
  },

  // 试验过程管理
  {
    id: "m-contracts",
    name: "合同管理",
    path: "/contracts",
    appId: APP_LAB_ID,
    parentId: "grp-biz",
    sort: 1,
    enabled: true,
    permission: "project:read",
  },
  {
    id: "m-receipts",
    name: "接样管理",
    path: "/receipts",
    appId: APP_LAB_ID,
    parentId: "grp-biz",
    sort: 2,
    enabled: true,
    permission: "sample:read",
  },
  {
    id: "m-personnel",
    name: "人员管理",
    path: "/personnel",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 1,
    enabled: true,
    permission: "org:read",
  },
  {
    id: "m-equipment",
    name: "设备管理",
    path: "/equipment",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 2,
    enabled: true,
    permission: "org:read",
  },
  {
    id: "m-facilities",
    name: "设施管理",
    path: "/facilities",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 3,
    enabled: true,
    permission: "org:read",
  },
  {
    id: "m-code-tables",
    name: "码表管理",
    path: "/master-data",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 4,
    enabled: true,
    permission: "org:read",
  },

  // 数据统计
  {
    id: "m-summary",
    name: "统计汇总",
    path: "/summary",
    appId: APP_LAB_ID,
    parentId: "grp-stat",
    sort: 1,
    enabled: true,
    permission: "report:read",
  },
];
