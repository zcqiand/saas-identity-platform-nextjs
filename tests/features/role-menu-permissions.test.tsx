/**
 * M03.F04 角色菜单权限绑定（fn-ID M03.F04.I01-I05）
 *
 * 数据落 role_menu_permissions 中间表（PK = (roleId, menuId)，actions 是 PG text[] 数组）。
 *
 * 覆盖：I01 按角色查询 / I02 新增 / I03 编辑（先清后插）/ I04 删除 / I05 store 内部接口
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  listRoleMenuPermissionsByRole,
  setRoleMenuPermissions,
} from "@/lib/role-menu-permissions-store";
import { seedDatabase } from "@/db/seed";
import { db } from "@/db";
import { roleMenuPermissions, roles, appMenus } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fnTest } from "../fn";

beforeAll(async () => {
  await seedDatabase();
});

afterAll(async () => {
  // 不清库，per-pid schema 隔离
});

describe("M03.F04 role menu permissions store", () => {
  // v0.3.1.3：8 条 SaaS 角色 menuPermissions 已删（m-lab-01..22 FK 失败），
  // 仅 lab 角色（role-lab-admin / role-lab-editor 等）保留 menuPermissions。
  // role-admin / role-editor 当前 shared seed 中 menuPermissions=[]，属 by-design。
  fnTest(["M03.F04.I01"], "I01 按角色查询（role-helpdesk 通过 store 设置菜单权限）", async () => {
    // v0.4.1 codegen barrel：seed 不再灌 SaaS 角色 menuPermissions；
    // 用 store 自填 + 验证 listRoleMenuPermissionsByRole 路径。
    await setRoleMenuPermissions("role-helpdesk", [
      { menuId: "m-lab-dash", actions: ["view"] },
      { menuId: "grp-res", actions: ["view", "create"] },
    ]);
    const rows = await listRoleMenuPermissionsByRole("role-helpdesk");
    expect(rows.length).toBe(2);
    for (const row of rows) {
      expect(row.roleId).toBe("role-helpdesk");
      expect(Array.isArray(row.actions)).toBe(true);
    }
  });

  fnTest(["M03.F04.I01"], "I01 不存在的角色返回空数组", async () => {
    const rows = await listRoleMenuPermissionsByRole("role-not-exist");
    expect(rows).toEqual([]);
  });

  fnTest(["M03.F04.I02", "M03.F04.I05"], "I02+I05 新增角色菜单权限（setRoleMenuPermissions 整批）", async () => {
    await setRoleMenuPermissions("role-auditor", [
      { menuId: "m-lab-dash", actions: ["view", "create"] },
      { menuId: "grp-res", actions: ["view"] },
    ]);

    const after = await listRoleMenuPermissionsByRole("role-auditor");
    expect(after.length).toBe(2);
    const dash = after.find((r) => r.menuId === "m-lab-dash")!;
    expect(dash.actions).toEqual(["view", "create"]);
  });

  fnTest(["M03.F04.I03", "M03.F04.I05"], "I03+I05 编辑：setRoleMenuPermissions 是「先清后插」（差量替换）", async () => {
    // 上一步已给 role-auditor 两条；现在替换成完全不同的菜单
    await setRoleMenuPermissions("role-auditor", [
      { menuId: "m-receipts", actions: ["view", "update", "delete"] },
    ]);

    const rows = await listRoleMenuPermissionsByRole("role-auditor");
    expect(rows.length).toBe(1);
    expect(rows[0]!.menuId).toBe("m-receipts");
    expect(rows[0]!.actions).toEqual(["view", "update", "delete"]);

    // 老的两条被清掉了
    const dash = rows.find((r) => r.menuId === "m-lab-dash");
    expect(dash).toBeUndefined();
  });

  fnTest(["M03.F04.I04", "M03.F04.I05"], "I04+I05 删除：传空数组 = 清空", async () => {
    await setRoleMenuPermissions("role-helpdesk", []);
    const rows = await listRoleMenuPermissionsByRole("role-helpdesk");
    expect(rows).toEqual([]);
  });

  // v0.3.1.3 起 8 SaaS 角色 menuPermissions 已删（m-lab-01..22 FK 失败）；仅 lab 角色保留。
  // 改用 setRoleMenuPermissions 直接灌入测试数据，验证 actions 数组透传。
  fnTest(["M03.F04.I05"], "I05 内部接口：role-helpdesk 通过 store 设置的 actions 数组含 view/create", async () => {
    await setRoleMenuPermissions("role-helpdesk", [
      { menuId: "m-lab-dash", actions: ["view", "create"] },
      { menuId: "grp-res", actions: ["view"] },
    ]);
    const rows = await listRoleMenuPermissionsByRole("role-helpdesk");
    expect(rows.length).toBe(2);
    const dash = rows.find((r) => r.menuId === "m-lab-dash")!;
    expect(dash.actions).toContain("view");
    expect(dash.actions).toContain("create");
  });

  fnTest(["M03.F04.I05"], "I05 直接查中间表：role-helpdesk 至少有 m-lab-dash", async () => {
    // m-lab-dash 是 v0.4.x 唯一全角色可见的菜单（5 个 grp-* + 27 个 lab 角色含）
    await setRoleMenuPermissions("role-helpdesk", [
      { menuId: "m-lab-dash", actions: ["view"] },
    ]);
    const rows = await db
      .select()
      .from(roleMenuPermissions)
      .where(eq(roleMenuPermissions.roleId, "role-helpdesk"));
    expect(rows.length).toBeGreaterThan(0);
    const dash = rows.find((r) => r.menuId === "m-lab-dash");
    expect(dash).toBeTruthy();
  });

  it("role-helpdesk 的 actions 数组长度大于 1（覆盖 store 的「多操作」语义）", async () => {
    await setRoleMenuPermissions("role-helpdesk", [
      { menuId: "m-lab-dash", actions: ["view", "create", "update", "delete"] },
    ]);
    const rows = await listRoleMenuPermissionsByRole("role-helpdesk");
    const withMultipleActions = rows.filter((r) => r.actions.length > 1);
    expect(withMultipleActions.length).toBeGreaterThan(0);
  });

  it("app_menus 表里 m-lab-dash 真实存在（FK target 验证）", async () => {
    const [m] = await db.select().from(appMenus).where(eq(appMenus.id, "m-lab-dash"));
    expect(m).toBeTruthy();
    expect(m!.appId).toBe("app-lab");
  });

  it("roles 表里 role-admin / role-helpdesk / role-lab-admin 都真实存在（来源 truth）", async () => {
    // v0.3.1.3 SaaS 角色 menuPermissions 已删，但 roles 行还在；FK 验真性需 role 自身可查
  const ids = ["role-admin", "role-helpdesk", "role-lab-admin"];
    for (const id of ids) {
      const [row] = await db.select().from(roles).where(eq(roles.id, id));
      expect(row).toBeTruthy();
    }
  });
});