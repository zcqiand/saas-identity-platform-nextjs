/**
 * M06.F14 菜单模板（fn-ID M06.F14.I01-I02）
 *
 * 数据：menu_templates 表（每 app 单例，PK = appId）。
 *
 * 覆盖：I01 按 app 查询 / I02 upsert
 */
import { beforeAll, describe, expect, it } from "vitest";
import {
  getMenuTemplateByApp,
  upsertMenuTemplate,
} from "@/lib/menu-template-store";
import { seedDatabase } from "@/db/seed";
import { db } from "@/db";
import { menuTemplates } from "@/db/schema";
import { eq } from "drizzle-orm";
import { fnTest } from "../fn";

beforeAll(async () => {
  await seedDatabase();
});

describe("M06.F14 menu templates", () => {
  fnTest(["M06.F14.I01"], "I01 按 app 查询（app-lab 来自 shared seed）", async () => {
    const tpl = await getMenuTemplateByApp("app-lab");
    expect(tpl).toBeTruthy();
    expect(tpl!.appId).toBe("app-lab");
    // menus 字段是 JSON 字符串
    const menus = JSON.parse(tpl!.menus);
    expect(Array.isArray(menus)).toBe(true);
    expect(menus.length).toBeGreaterThan(0);
  });

  fnTest(["M06.F14.I01"], "I01 不存在的 app 返回 null", async () => {
    const tpl = await getMenuTemplateByApp("app-not-exist");
    expect(tpl).toBeNull();
  });

  fnTest(["M06.F14.I02"], "I02 upsert 已有 app-lab：覆盖 menus 内容", async () => {
    const newMenus = [
      {
        id: "m-new-01",
        name: "新菜单 1",
        path: "new-1",
        appId: "app-lab",
        parentId: null,
        sort: 1,
        enabled: true,
      },
    ];
    const upserted = await upsertMenuTemplate("app-lab", newMenus);
    expect(upserted.appId).toBe("app-lab");
    const parsed = JSON.parse(upserted.menus);
    expect(parsed.length).toBe(1);
    expect(parsed[0].id).toBe("m-new-01");

    // 再查也一致
    const fetched = await getMenuTemplateByApp("app-lab");
    expect(fetched).toBeTruthy();
    expect(JSON.parse(fetched!.menus).length).toBe(1);
  });

  fnTest(["M06.F14.I02"], "I02 upsert 新 app（app-finance 已有 seed，应覆盖）", async () => {
    // shared seed 中 menu_templates 已含 app-finance
    const before = await getMenuTemplateByApp("app-finance");
    expect(before).toBeTruthy();

    const empty = await upsertMenuTemplate("app-finance", []);
    expect(empty.appId).toBe("app-finance");
    expect(JSON.parse(empty.menus)).toEqual([]);
  });

  fnTest(["M06.F14.I02"], "I02 upsert 全新 app：先插入后查询", async () => {
    const id = "app-test-iso";
    const before = await getMenuTemplateByApp(id);
    expect(before).toBeNull();

    const inserted = await upsertMenuTemplate(id, [
      { id: "t-01", name: "模板 1", path: "p1", appId: id, parentId: null, sort: 1, enabled: true },
    ]);
    expect(inserted.appId).toBe(id);

    const after = await getMenuTemplateByApp(id);
    expect(after).toBeTruthy();
    const menus = JSON.parse(after!.menus);
    expect(menus[0].id).toBe("t-01");
  });

  fnTest(["M06.F14.I01"], "I01 直接查表：shared seed 灌入了 3 行（app-lab/app-erp/app-finance）", async () => {
    const rows = await db.select().from(menuTemplates);
    const ids = rows.map((r) => r.appId);
    expect(ids).toContain("app-lab");
    expect(ids).toContain("app-erp");
    expect(ids).toContain("app-finance");
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });

  it("M06.F14 完整 upsert 周期：清空 menus 后再灌回", async () => {
    const id = "app-test-cycle";
    await upsertMenuTemplate(id, []);
    const empty = await getMenuTemplateByApp(id);
    expect(JSON.parse(empty!.menus)).toEqual([]);

    await upsertMenuTemplate(id, [
      { id: "cy-01", name: "cycle", path: "cy", appId: id, parentId: null, sort: 1, enabled: true },
      { id: "cy-02", name: "cycle 2", path: "cy2", appId: id, parentId: null, sort: 2, enabled: false },
    ]);
    const refilled = await getMenuTemplateByApp(id);
    const parsed = JSON.parse(refilled!.menus);
    expect(parsed.length).toBe(2);
    expect(parsed[1].enabled).toBe(false);
  });

  it("M06.F14 menus 字段存的是字符串（JSON 序列化）", async () => {
    const tpl = await getMenuTemplateByApp("app-erp");
    expect(tpl).toBeTruthy();
    expect(typeof tpl!.menus).toBe("string");
  });

  it("M06.F14 更新 app-lab 后查表 menus 是新内容", async () => {
    const [row] = await db.select().from(menuTemplates).where(eq(menuTemplates.appId, "app-lab"));
    expect(row).toBeTruthy();
    const parsed = JSON.parse(row!.menus);
    expect(parsed[0].id).toBe("m-new-01");
  });
});