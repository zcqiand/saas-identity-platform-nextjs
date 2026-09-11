// 侧边栏导航数据源：一级 = 功能模块（M 级），二级 = 功能（F 级）。
// 唯一锚点是 saas-identity-platform-shared/docs/functions/function-tree.md 的模块总览：
//   M00 租户管理（F01 租户维护 / F02 租户成员 / F03 租户角色 / F05 租户应用）
//   M04 应用管理（F01 应用维护 / F04 菜单管理）
// 纯数据模块：不碰 router / store，测试直接断言层级结构（tests/integration/nav-modules）。
// fnId = 权限点（一个子项 = 一个权限点），页面挂 data-fn 用，改动须同 commit 评审。
// M01 用户管理（whoami/SSO 视图）无控制台路由，不进 nav；
// M00.F04 角色权限挂角色下钻路由（/roles/:rid/menus），非 nav 直达页。
import type { ReactNode } from "react";
import { Building2, Users, Shield, Boxes, FolderTree } from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  group: string;
  icon: ReactNode;
  /** data-fn M-ID for L5 alignment */
  fnId?: string;
}

export function buildNavItems(tenantForNav: string): NavItem[] {
  return [
    // M00 租户管理（模块）
    {
      to: "/tenants",
      label: "租户维护",
      group: "租户管理",
      icon: <Building2 className="h-4 w-4" />,
      fnId: "M00.F01.I01",
    },
    {
      to: `/tenants/${tenantForNav}/members`,
      label: "租户成员",
      group: "租户管理",
      icon: <Users className="h-4 w-4" />,
      fnId: "M00.F02.I01",
    },
    {
      to: `/tenants/${tenantForNav}/roles`,
      label: "租户角色",
      group: "租户管理",
      icon: <Shield className="h-4 w-4" />,
      fnId: "M00.F03.I01",
    },
    // M00.F05 租户应用（开发中，4 后端 + msw 未全齐）
    {
      to: `/tenants/${tenantForNav}/applications`,
      label: "租户应用",
      group: "租户管理",
      icon: <Boxes className="h-4 w-4" />,
      fnId: "M00.F05.I01",
    },
    // M04 应用管理（模块）；M05（API Key）+ M06（审计日志）已废止，nav 链接删（route + UI page 已删）。
    {
      to: "/admin/apps",
      label: "应用维护",
      group: "应用管理",
      icon: <Boxes className="h-4 w-4" />,
      fnId: "M04.F01.I01",
    },
    {
      to: "/admin/apps/lab-management/menus",
      label: "菜单管理",
      group: "应用管理",
      icon: <FolderTree className="h-4 w-4" />,
      fnId: "M04.F04.I01",
    },
  ];
}
