// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ProtectedLayout } from "@/app/(protected)/layout-client";
import * as tenantStore from "@/lib/tenant-store";
import { db } from "@/db";
import { seedDatabase } from "@/db/seed";
import { eq } from "drizzle-orm";
import { tenants } from "@/db/schema";
import { fnTest } from "../fn";

/**
 * M01.F01.I08 租户布局与切换 — ProtectedLayout
 *
 * server component 在 SSR 启动时：
 *   1. 读 cookie → 调 setCurrentTenant(id)
 *   2. 调 applyTheme(currentTenant.theme)
 *   3. 渲染 <html data-tenant="..."> + <style>{css}</style>
 *
 * 客户端 wrapper（ProtectedLayout）导出，方便 jsdom 测试；server 组件
 * (protected)/layout.tsx 是包装层。
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  seedDatabase();
  tenantStore.setCurrentTenant(0);
});

describe("M01.F01.I08 ProtectedLayout", () => {
  fnTest(["M01.F01.I08"], "根元素挂 data-fn M01.F01.I08", () => {
    const acme = db.select().from(tenants).where(eq(tenants.code, "acme")).get();
    if (acme) tenantStore.setCurrentTenant(acme.id);
    const { getByTestId } = render(
      <ProtectedLayout>
        <div>child</div>
      </ProtectedLayout>,
    );
    expect(getByTestId("protected-layout").getAttribute("data-fn")).toBe("M01.F01.I08");
  });

  it("data-tenant 属性跟随当前 tenant theme", () => {
    const acme = db.select().from(tenants).where(eq(tenants.code, "acme")).get();
    if (acme) tenantStore.setCurrentTenant(acme.id);
    const { getByTestId } = render(
      <ProtectedLayout>
        <div>child</div>
      </ProtectedLayout>,
    );
    const root = getByTestId("protected-layout");
    // applyTheme("default") 输出 :root[data-tenant="default"] {...}
    // 我们的 wrapper div 不直接带 data-tenant，但 style 标签带
    const style = root.querySelector("style");
    expect(style?.textContent).toContain("data-tenant=\"default\"");
  });

  it("切换到 dark tenant 后 style 标签用 dark 主题", () => {
    const dark = db.select().from(tenants).where(eq(tenants.code, "globex")).get();
    if (dark) tenantStore.setCurrentTenant(dark.id);
    const { getByTestId } = render(
      <ProtectedLayout>
        <div>child</div>
      </ProtectedLayout>,
    );
    const style = getByTestId("protected-layout").querySelector("style");
    expect(style?.textContent).toContain("data-tenant=\"dark\"");
  });

  it("未设置当前租户 → 不渲染 style（clearTheme）", () => {
    tenantStore.setCurrentTenant(0); // 不存在 id → getCurrentTenant 返回 null
    // 实际：setCurrentTenant(0) 设了 0，getCurrentTenant(null → null)
    // 但 setCurrentTenant(0) 会设 cache 0，getTenant(0) → null
    const { getByTestId } = render(
      <ProtectedLayout>
        <div>child</div>
      </ProtectedLayout>,
    );
    const style = getByTestId("protected-layout").querySelector("style");
    expect(style?.textContent ?? "").toBe("");
  });
});