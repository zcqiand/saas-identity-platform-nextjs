// Sanity check: 从 saas-msw 拉 fixtures，构造 lab-management 的菜单树
// 用法：node scripts/check-fixtures.mjs
import {
  apps,
  menus,
  roleMenuGrants,
} from "@saas/identity-platform-msw";

console.log("apps.length=", apps.length);
console.log("menus.length=", menus.length);
console.log("roleMenuGrants.length=", roleMenuGrants.length);

const app = apps.find((a) => a.code === "lab-management");
console.log("found app:", app ? { id: app.id, code: app.code, status: app.status } : null);

const grant = roleMenuGrants.find(
  (g) => g.roleId === "00000000-0000-0000-0000-000000000001-role-admin",
);
console.log("found grant:", grant ? { menuIds: grant.menuIds.length } : null);

const allowed = new Set(grant?.menuIds ?? []);

const tree = (parentId, appId) =>
  menus
    .filter((m) => m.appId === appId && m.parentId === parentId && m.status === "active")
    .filter((m) => allowed.has(m.id) || !parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((m) => ({ code: m.code, name: m.name, children: tree(m.id, m.appId) }));

const result = app ? tree(undefined, app.id) : [];
console.log("tree top-level:", result.length, "items");
console.log(JSON.stringify(result.map((n) => ({ code: n.code, name: n.name, childCount: n.children.length })), null, 2));