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
  fnTest(["M03.F04.I01"], "I01 按角色查询（role-admin 来自 shared seed）", async () => {
    const rows = await listRoleMenuPermissionsByRole("role-admin");
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.roleId).toBe("role-admin");
      expect(Array.isArray(row.actions)).toBe(true);
    }
  });

  fnTest(["M03.F04.I01"], "I01 不存在的角色返回空数组", async () => {
    const rows = await listRoleMenuPermissionsByRole("role-not-exist");
    expect(rows).toEqual([]);
  });

  fnTest(["M03.F04.I02", "M03.F04.I05"], "I02+I05 新增角色菜单权限（setRoleMenuPermissions 整批）", async () => {
    // role-editor 来自 shared seed，先确认无菜单权限
    const before = await listRoleMenuPermissionsByRole("role-editor");
    expect(before.length).toBe(0);

    await setRoleMenuPermissions("role-editor", [
      { menuId: "m-lab-01", actions: ["view", "create"] },
      { menuId: "m-lab-02", actions: ["view"] },
    ]);

    const after = await listRoleMenuPermissionsByRole("role-editor");
    expect(after.length).toBe(2);
    const lab01 = after.find((r) => r.menuId === "m-lab-01")!;
    expect(lab01.actions).toEqual(["view", "create"]);
  });

  fnTest(["M03.F04.I03", "M03.F04.I05"], "I03+I05 编辑：setRoleMenuPermissions 是「先清后插」（差量替换）", async () => {
    // 上一步已给 role-editor 两条；现在替换成完全不同的菜单
    await setRoleMenuPermissions("role-editor", [
      { menuId: "m-lab-05", actions: ["view", "update", "delete"] },
    ]);

    const rows = await listRoleMenuPermissionsByRole("role-editor");
    expect(rows.length).toBe(1);
    expect(rows[0]!.menuId).toBe("m-lab-05");
    expect(rows[0]!.actions).toEqual(["view", "update", "delete"]);

    // 老的两条被清掉了
    const lab01 = rows.find((r) => r.menuId === "m-lab-01");
    expect(lab01).toBeUndefined();
  });

  fnTest(["M03.F04.I04", "M03.F04.I05"], "I04+I05 删除：传空数组 = 清空", async () => {
    await setRoleMenuPermissions("role-editor", []);
    const rows = await listRoleMenuPermissionsByRole("role-editor");
    expect(rows).toEqual([]);
  });

  fnTest(["M03.F04.I05"], "I05 内部接口：shared role-admin 在中间表里 actions 含 view/create/update/delete", async () => {
    const rows = await listRoleMenuPermissionsByRole("role-admin");
    // shared seed role-admin 第一个菜单 actions 数组就是 view/create/update/delete
    expect(rows.length).toBeGreaterThan(0);
    const first = rows[0]!;
    expect(first.actions).toContain("view");
    expect(first.actions).toContain("create");
  });

  fnTest(["M03.F04.I05"], "I05 直接查中间表：role-lab-admin 至少有 m-lab-dash", async () => {
    const rows = await db
      .select()
      .from(roleMenuPermissions)
      .where(eq(roleMenuPermissions.roleId, "role-lab-admin"));
    expect(rows.length).toBeGreaterThan(0);
    const dash = rows.find((r) => r.menuId === "m-lab-dash");
    expect(dash).toBeTruthy();
  });

  it("role-admin 的 actions 数组长度大于 1（覆盖共享 seed 的「多操作」语义）", async () => {
    const rows = await listRoleMenuPermissionsByRole("role-admin");
    const withMultipleActions = rows.filter((r) => r.actions.length > 1);
    expect(withMultipleActions.length).toBeGreaterThan(0);
  });

  it("app_menus 表里 m-lab-dash 真实存在（FK target 验证）", async () => {
    const [m] = await db.select().from(appMenus).where(eq(appMenus.id, "m-lab-dash"));
    expect(m).toBeTruthy();
    expect(m!.appId).toBe("app-lab");
  });

  it("roles 表里 role-admin / role-editor / role-lab-admin 都真实存在（来源 truth）", async () => {
    const ids = ["role-admin", "role-editor", "role-lab-admin"];
    for (const id of ids) {
      const [row] = await db.select().from(roles).where(eq(roles.id, id));
      expect(row).toBeTruthy();
    }
  });
});