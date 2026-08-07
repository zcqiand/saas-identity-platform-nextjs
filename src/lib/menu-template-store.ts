/**
 * M06.F14 菜单模板 — menu_templates 表 store（每 app 单例）
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 menuTemplates 表。
 * 表 PK 是 appId：1 行 = 1 app 的菜单树快照（menus 字段是 JSON 字符串）。
 * upsert 不存在则插入，存在则更新 menus + 走数据库默认 updatedAt。
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import {
  menuTemplates,
  type MenuTemplate,
  type NewMenuTemplate,
} from "@/db/schema";

export async function getMenuTemplateByApp(appId: string): Promise<MenuTemplate | null> {
  const [row] = await db
    .select()
    .from(menuTemplates)
    .where(eq(menuTemplates.appId, appId));
  return row ?? null;
}

export async function upsertMenuTemplate(
  appId: string,
  menus: unknown,
): Promise<MenuTemplate> {
  const serialized = JSON.stringify(menus);
  const existing = await getMenuTemplateByApp(appId);
  if (existing) {
    await db
      .update(menuTemplates)
      .set({ menus: serialized })
      .where(eq(menuTemplates.appId, appId));
    const updated = await getMenuTemplateByApp(appId);
    if (!updated) throw new Error("menu_template row missing after upsert");
    return updated;
  }
  const input: NewMenuTemplate = { appId, menus: serialized };
  const [row] = await db.insert(menuTemplates).values(input).returning();
  if (!row) throw new Error("menu_template insert returned no row");
  return row;
}