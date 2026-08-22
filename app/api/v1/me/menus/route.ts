// /api/v1/me/menus?appCode=<code> - M09.F03.I04
//
// TypeSpec: getMyMenus(appCode): EffectiveMenuNode[]
// 返回当前用户在指定 appCode 下的有效菜单（树形）。
//
// demo 模式：读 seed JSON（src/lib/demo-seeds.ts，ADR-0012 运行时 import 清零
// 后不再 JS import saas-msw 包）。Phase 6 接 DB。
// 跨仓 lab-nextjs 反代时 CORS + 跨实例都通过这层 Route Handler。

import { NextRequest, NextResponse } from "next/server";
import { loadSeedJson } from "@/lib/demo-seeds";

type App = {
  id: string;
  code: string;
  status: string;
};
type Menu = {
  id: string;
  appId: string;
  parentId?: string | null;
  status: string;
  sortOrder: number;
  code: string;
  name: string;
  path?: string;
  icon?: string;
  type: string;
};
type RoleMenuGrant = { roleId: string; menuIds: string[] };

// 惰性加载：模块顶层读会在 build 期（seeds 未就位时）炸；首个请求再读。
// msw 不持久化，demo 数据只读不写，进程内缓存安全。
let _fixtures: { apps: App[]; menus: Menu[]; grants: RoleMenuGrant[] } | null = null;
function fixtures() {
  if (!_fixtures) {
    _fixtures = {
      apps: loadSeedJson<App[]>("apps.json"),
      menus: loadSeedJson<Menu[]>("menus.json"),
      grants: loadSeedJson<RoleMenuGrant[]>("role-menu-grants.json"),
    };
  }
  return _fixtures;
}

type EffectiveMenuNode = {
  id: string;
  appId: string;
  parentId?: string;
  code: string;
  name: string;
  path?: string;
  icon?: string;
  type: string;
  sortOrder: number;
  children: EffectiveMenuNode[];
};

/** 在 seed 上按 appCode 构造树（无 RBAC；saas-msw 的 /me/menus handler 同款） */
function fromFixtures(appCode: string): EffectiveMenuNode[] {
  const { apps, menus, grants } = fixtures();
  const app = apps.find((a) => a.code === appCode && a.status === "active");
  if (!app) return [];

  const acmeAdminGrant = grants.find(
    (g) => g.roleId === "00000000-0000-0000-0000-000000000001-role-admin",
  );
  const allowed = new Set(acmeAdminGrant?.menuIds ?? []);

  const tree = (parentId: string | undefined, appId: string): EffectiveMenuNode[] => {
    // JSON 解析后 parentId 是 null（不是 undefined）；normalize 后再做 === 比较
    const wantParent = parentId ?? null;
    return menus
      .filter(
        (m) => m.appId === appId && (m.parentId ?? null) === wantParent && m.status === "active",
      )
      .filter((m) => allowed.has(m.id) || !parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((m) => ({
        id: m.id,
        appId: m.appId,
        parentId: m.parentId ?? undefined,
        code: m.code,
        name: m.name,
        path: m.path ?? undefined,
        icon: m.icon ?? undefined,
        type: m.type,
        sortOrder: m.sortOrder,
        children: tree(m.id, m.appId),
      }));
  };

  return tree(undefined, app.id);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(req.url);
    const appCode = url.searchParams.get("appCode");
    if (!appCode) {
      return NextResponse.json(
        {
          code: "BAD_REQUEST",
          message: "appCode query parameter is required",
        },
        { status: 400 },
      );
    }
    const result = fromFixtures(appCode);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      {
        code: "INTERNAL_ERROR",
        message: (err as Error).message,
      },
      { status: 500 },
    );
  }
}
