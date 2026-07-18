/**
 * M01.F01 多租户切换 — 租户 store 接口层
 *
 * 数据：Drizzle 直查 src/db/schema.ts 的 tenants 表（5 字段 + 1 unique code）。
 * 当前租户：用 module-level 缓存（per-process），由 (protected)/layout.tsx 在
 * SSR 启动时从 cookie 同步；setCurrentTenant / getCurrentTenant 直接读写缓存。
 *
 * 不用 zod：CRUD 入参字段少（3-4 个），手写守卫够；多到 10+ 字段再考虑。
 */
import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants, type NewTenant, type Tenant } from "@/db/schema";

/** 当前租户的进程内缓存。SSR 启动时由 (protected)/layout.tsx 从 cookie 灌入 */
let currentTenantId: number | null = null;

export function listTenants(): Tenant[] {
  return db.select().from(tenants).all();
}

export function getTenant(id: number): Tenant | null {
  return db.select().from(tenants).where(eq(tenants.id, id)).get() ?? null;
}

export function createTenant(input: Omit<NewTenant, "id" | "createdAt">): Tenant {
  const inserted = db.insert(tenants).values(input).returning().get();
  return inserted;
}

export function updateTenant(
  id: number,
  patch: Partial<Pick<NewTenant, "name" | "theme">>,
): Tenant | null {
  const existing = getTenant(id);
  if (!existing) return null;
  const merged: NewTenant = { ...existing, ...patch };
  db.update(tenants)
    .set({ name: merged.name, theme: merged.theme })
    .where(eq(tenants.id, id))
    .run();
  return getTenant(id);
}

export function deleteTenant(id: number): boolean {
  const result = db.delete(tenants).where(eq(tenants.id, id)).run();
  return result.changes > 0;
}

export function setCurrentTenant(id: number): void {
  currentTenantId = id;
}

export function getCurrentTenant(): Tenant | null {
  if (currentTenantId === null) return null;
  return getTenant(currentTenantId);
}