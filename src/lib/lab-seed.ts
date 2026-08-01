/**
 * M03.F02 身份集成 - lab 业务数据种子
 *
 * saas 仓给 lab 仓的 OAuth 委托用的"数据契约"：租户 / 组织 / 角色 / 业务权限 / 菜单。
 * 与 saas-React 仓 msw/db.ts 独立设计 —— saas-React 仓是 mock 本地演示，saas-nextjs 仓
 * 是真 SQLite，菜单项按 lab-nextjs 当前已实现的路由裁剪（避免出现 lab 仓没实现的路由
 * 让侧边栏渲染出死链）。
 *
 * 与 REF（lab-management-system 仓 Layout.tsx + saas-React LAB_LAB_MENUS）对齐：
 *   - 5 分组（资源管理 / 试验过程管理 / 数据统计 / 检测能力 / 基础数据）+ 顶级仪表盘
 *   - 菜单项与 lab-React REF 1:1 命名（合同管理/接样管理/任务安排/数据录入/报告审核/报告批准/
 *     报告发放/报告归档/统计汇总/报告名称/参数界面/型号维护/规格维护/等级维护/牌号维护/
 *     计算规则/技术要求/检测专项/检测项目/检测参数/检测标准）
 *   - path 与 lab-nextjs/src/app/(protected)/** 路由对齐
 *   - 试验过程管理（receipts/task/entry/review/approve/issue/archive 7 项）lab-nextjs
 *     暂未实现任意一个 → 全 enabled=false，sidebar 渲染带「规划」徽标 + 跳 /coming-soon
 *     （避免真路由 404）
 *   - 检测能力 4 项（spec/obj/param/std）lab-vue 已实现但 lab-nextjs 未实现 → enabled=false
 *   - 基础数据 8 项（report-names/param-ifs/models/specs/grades/brands/calc-rules/tech-req）：
 *     - m-report-names / m-calc-rules / m-tech-req lab-vue 已实现（master-data/* 路由）→ enabled=true
 *     - m-models/m-specs/m-grades/m-brands lab-vue 已实现（master-data/* 路由）→ enabled=true
 *     - m-param-ifs lab-vue 未实现（无 param-interfaces 路由）→ enabled=false
 *   - 不再放 grp-sys（机构/用户/角色管理已委托 saas，M01.F01-F03 标已废弃，不在菜单）
 *
 * 注：原 version 14 项是简版（5 组 + 14 叶）；本轮扩到 22 项（1 顶级 + 5 组 + 21 叶但去重后 22）
 * 对齐 lab-React REF 25 项（1 顶级 + 5 组 + 23 叶）。少 1 项是因为 lab-vue 有报告名称/技术要求
 * 等路由但 lab-nextjs 没；下一轮加 lab-nextjs 路由时再补 1 项。
 */

export const LAB_TENANT = {
  id: "tenant-lab",
  name: "示例建筑工程检测实验室",
  theme: "#2563eb",
  logoText: "LAB",
} as const;

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

/** lab 业务菜单 - 5 分组 + 1 顶级仪表盘 + 22 叶（与 lab-React REF 1:1 命名）
 *  - sort: 顶级 m-lab-dash=1, 5 分组 15/20/30/40/50（中间空 sort 给组内插入）
 *  - enabled: lab-nextjs 已实现路由的菜单项 enabled=true；未实现的 = false（占位/规划）
 */
export const LAB_MENUS: readonly LabMenu[] = [
  // 顶级
  {
    id: "m-lab-dash",
    name: "仪表盘",
    path: "/",
    appId: APP_LAB_ID,
    parentId: null,
    sort: 1,
    enabled: true,
  },

  // 资源管理（sort=15）
  {
    id: "grp-res",
    name: "资源管理",
    path: "",
    appId: APP_LAB_ID,
    parentId: null,
    sort: 15,
    enabled: true,
  },
  {
    id: "m-contracts",
    name: "合同管理",
    path: "/contracts",
    appId: APP_LAB_ID,
    parentId: "grp-res",
    sort: 1,
    enabled: true,
    permission: "project:read",
  },
  {
    id: "m-personnel",
    name: "人员管理",
    path: "/personnel",
    appId: APP_LAB_ID,
    parentId: "grp-res",
    sort: 2,
    enabled: true,
    permission: "project:read",
  },
  {
    id: "m-equipment",
    name: "设备管理",
    path: "/equipment",
    appId: APP_LAB_ID,
    parentId: "grp-res",
    sort: 3,
    enabled: true,
    permission: "project:read",
  },
  {
    id: "m-facilities",
    name: "设施环境",
    path: "/facilities",
    appId: APP_LAB_ID,
    parentId: "grp-res",
    sort: 4,
    enabled: true,
    permission: "project:read",
  },

  // 试验过程管理（sort=20）
  {
    id: "grp-biz",
    name: "试验过程管理",
    path: "",
    appId: APP_LAB_ID,
    parentId: null,
    sort: 20,
    enabled: true,
  },
  {
    id: "m-receipts",
    name: "接样管理",
    path: "/receipts",
    appId: APP_LAB_ID,
    parentId: "grp-biz",
    sort: 1,
    enabled: false,
    permission: "sample:read",
  },
  {
    id: "m-task",
    name: "任务安排",
    path: "/task-assignment",
    appId: APP_LAB_ID,
    parentId: "grp-biz",
    sort: 2,
    enabled: false,
    permission: "report:write",
  },
  {
    id: "m-entry",
    name: "数据录入",
    path: "/data-entry",
    appId: APP_LAB_ID,
    parentId: "grp-biz",
    sort: 3,
    enabled: false,
    permission: "report:write",
  },
  {
    id: "m-review",
    name: "报告审核",
    path: "/report-review",
    appId: APP_LAB_ID,
    parentId: "grp-biz",
    sort: 4,
    enabled: false,
    permission: "report:read",
  },
  {
    id: "m-approve",
    name: "报告批准",
    path: "/report-approve",
    appId: APP_LAB_ID,
    parentId: "grp-biz",
    sort: 5,
    enabled: false,
    permission: "report:issue",
  },
  {
    id: "m-issue",
    name: "报告发放",
    path: "/report-issue",
    appId: APP_LAB_ID,
    parentId: "grp-biz",
    sort: 6,
    enabled: false,
    permission: "report:read",
  },
  {
    id: "m-archive",
    name: "报告归档",
    path: "/report-archive",
    appId: APP_LAB_ID,
    parentId: "grp-biz",
    sort: 7,
    enabled: false,
    permission: "report:read",
  },

  // 数据统计（sort=30）
  {
    id: "grp-stat",
    name: "数据统计",
    path: "",
    appId: APP_LAB_ID,
    parentId: null,
    sort: 30,
    enabled: true,
  },
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

  // 检测能力（sort=40）
  {
    id: "grp-insp",
    name: "检测能力",
    path: "",
    appId: APP_LAB_ID,
    parentId: null,
    sort: 40,
    enabled: true,
  },
  {
    id: "m-insp-spec",
    name: "检测专项",
    path: "/inspection-specialties",
    appId: APP_LAB_ID,
    parentId: "grp-insp",
    sort: 1,
    enabled: false,
  },
  {
    id: "m-insp-obj",
    name: "检测项目",
    path: "/inspection-objects",
    appId: APP_LAB_ID,
    parentId: "grp-insp",
    sort: 2,
    enabled: false,
  },
  {
    id: "m-insp-param",
    name: "检测参数",
    path: "/inspection-parameters",
    appId: APP_LAB_ID,
    parentId: "grp-insp",
    sort: 3,
    enabled: false,
  },
  {
    id: "m-insp-std",
    name: "检测标准",
    path: "/inspection-standards",
    appId: APP_LAB_ID,
    parentId: "grp-insp",
    sort: 4,
    enabled: false,
  },

  // 基础数据（sort=50）
  {
    id: "grp-master",
    name: "基础数据",
    path: "",
    appId: APP_LAB_ID,
    parentId: null,
    sort: 50,
    enabled: true,
  },
  {
    id: "m-report-names",
    name: "报告名称",
    path: "/master-data/report-categories",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 1,
    enabled: true,
    permission: "report:read",
  },
  {
    id: "m-param-ifs",
    name: "参数界面",
    path: "/param-interfaces",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 2,
    enabled: false,
  },
  {
    id: "m-models",
    name: "型号维护",
    path: "/master-data/report-models",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 3,
    enabled: true,
    permission: "report:read",
  },
  {
    id: "m-specs",
    name: "规格维护",
    path: "/master-data/report-specs",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 4,
    enabled: true,
    permission: "report:read",
  },
  {
    id: "m-grades",
    name: "等级维护",
    path: "/master-data/report-grades",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 5,
    enabled: true,
    permission: "report:read",
  },
  {
    id: "m-brands",
    name: "牌号维护",
    path: "/master-data/report-brands",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 6,
    enabled: true,
    permission: "report:read",
  },
  {
    id: "m-calc-rules",
    name: "计算规则",
    path: "/master-data/calculation-rules",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 7,
    enabled: true,
    permission: "report:read",
  },
  {
    id: "m-tech-req",
    name: "技术要求",
    path: "/master-data/technical-requirements",
    appId: APP_LAB_ID,
    parentId: "grp-master",
    sort: 8,
    enabled: true,
    permission: "report:read",
  },
];
