// /api/v1/me/menus?appCode=<code> — M09.F03.I04
//
// TypeSpec: getMyMenus(appCode): EffectiveMenuNode[]
// 返回当前用户在指定 appCode 下的有效菜单（树形）。
//
// demo 模式：直接读 saas-msw 的 JSON fixtures 文件（用 fs.readFile 避开
// `with { type: "json" }` 在 Next.js webpack 下的解析歧义）。Phase 6 接 DB。
// 跨仓 lab-nextjs 反代时 CORS + 跨实例都通过这层 Route Handler。

import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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

// 直接读 saas-msw 的 JSON fixtures（避开 `with { type: "json" }` 解析问题）。
// SEEDS_DIR = saas-msw/src/seeds/ —— Next.js dev 时 cwd = 项目根；prod build
// 时也以同项目布局打包，所以 `../saas-identity-platform-msw/src/seeds/` 跨仓读。
const SEEDS_DIR = resolve(process.cwd(), "../saas-identity-platform-msw/src/seeds");

// 加 fallback：cwd 路径不通时切 node_modules/...
let FIXTURES: { apps: App[]; menus: Menu[]; grants: RoleMenuGrant[] };
try {
  FIXTURES = {
    apps: JSON.parse(readFileSync(resolve(SEEDS_DIR, "apps.json"), "utf8")) as App[],
    menus: JSON.parse(readFileSync(resolve(SEEDS_DIR, "menus.json"), "utf8")) as Menu[],
    grants: JSON.parse(
      readFileSync(resolve(SEEDS_DIR, "role-menu-grants.json"), "utf8"),
    ) as RoleMenuGrant[],
  };
} catch (e1) {
  const FALLBACK_DIR = resolve(process.cwd(), "node_modules/@saas/identity-platform-msw/src/seeds");
  FIXTURES = {
    apps: JSON.parse(readFileSync(resolve(FALLBACK_DIR, "apps.json"), "utf8")) as App[],
    menus: JSON.parse(readFileSync(resolve(FALLBACK_DIR, "menus.json"), "utf8")) as Menu[],
    grants: JSON.parse(
      readFileSync(resolve(FALLBACK_DIR, "role-menu-grants.json"), "utf8"),
    ) as RoleMenuGrant[],
  };
}
const fixtureApps = FIXTURES.apps;
const fixtureMenus = FIXTURES.menus;
const fixtureRoleMenuGrants = FIXTURES.grants;

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

/** 在 fixtures 上按 appCode 构造树（无 RBAC；saas-msw 的 /me/menus handler 同款） */
function fromFixtures(appCode: string): EffectiveMenuNode[] {
  const app = fixtureApps.find((a) => a.code === appCode && a.status === "active");
  if (!app) return [];

  const acmeAdminGrant = fixtureRoleMenuGrants.find(
    (g) => g.roleId === "00000000-0000-0000-0000-000000000001-role-admin",
  );
  const allowed = new Set(acmeAdminGrant?.menuIds ?? []);

  const tree = (parentId: string | undefined, appId: string): EffectiveMenuNode[] => {
    // JSON 解析后 parentId 是 null（不是 undefined）；normalize 后再做 === 比较
    const wantParent = parentId ?? null;
    return fixtureMenus
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
    console.log(
      "[me/menus] cwd=",
      process.cwd(),
      "apps=",
      fixtureApps.length,
      "menus=",
      fixtureMenus.length,
      "grants=",
      fixtureRoleMenuGrants.length,
      "firstApp=",
      fixtureApps[0]?.code,
      "result=",
      result.length,
    );
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
