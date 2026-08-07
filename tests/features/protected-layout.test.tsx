// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { ProtectedLayout } from "@/app/(protected)/layout-client";
import * as tenantStore from "@/lib/tenant-store";
import { applyTheme } from "@/lib/theme";
import { db } from "@/db";
import { seedDatabase } from "@/db/seed";
import { eq } from "drizzle-orm";
import { tenants } from "@/db/schema";
import { fnTest } from "../fn";

/**
 * M01.F01.I08 租户布局与切换 — ProtectedLayout
 *
 * ProtectedLayout 是纯 client 组件（"use client"），不能 import server-only 模块。
 * CSS 字符串由 server layout 在 SSR 时算好作为 prop 透传过来。
 * 测试模拟 server 的行为：自己调 applyTheme() + setCurrentTenant() 再渲染。
 *
 * [COVERAGE-REGRESSION] v0.3.0 起 shared seeds 只有 acme + tenant-lab，
 * globex（dark theme）已移除。原 "切换到 dark tenant" 测试改为校验另一真实存在的租户。
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(async () => {
  await seedDatabase();
  tenantStore.setCurrentTenant("");
});

describe("M01.F01.I08 ProtectedLayout", () => {
  fnTest(["M01.F01.I08"], "根元素挂 data-fn M01.F01.I08", async () => {
    const acme = (await db.select().from(tenants).where(eq(tenants.code, "acme")))[0];
    if (acme) tenantStore.setCurrentTenant(acme.id);
    const { getByTestId } = render(
      <ProtectedLayout themeCss={acme ? applyTheme(acme.theme) : ""} currentTenantName={acme?.name ?? null}>
        <div>child</div>
      </ProtectedLayout>,
    );
    expect(getByTestId("protected-layout").getAttribute("data-fn")).toBe("M01.F01.I08");
  });

  it("data-tenant 属性跟随当前 tenant theme", async () => {
    const acme = (await db.select().from(tenants).where(eq(tenants.code, "acme")))[0];
    if (acme) tenantStore.setCurrentTenant(acme.id);
    const { getByTestId } = render(
      <ProtectedLayout themeCss={acme ? applyTheme(acme.theme) : ""} currentTenantName={acme?.name ?? null}>
        <div>child</div>
      </ProtectedLayout>,
    );
    const root = getByTestId("protected-layout");
    const style = root.querySelector("style");
    // applyTheme("default") 输出 [data-tenant="default"]{:root{...}}
    expect(style?.textContent).toContain('data-tenant="default"');
  });

  it("切换到 tenant-lab 后 style 标签用 tenant-lab 主题", async () => {
    const lab = (await db.select().from(tenants).where(eq(tenants.code, "tenant-lab")))[0];
    if (lab) tenantStore.setCurrentTenant(lab.id);
    const { getByTestId } = render(
      <ProtectedLayout themeCss={lab ? applyTheme(lab.theme) : ""} currentTenantName={lab?.name ?? null}>
        <div>child</div>
      </ProtectedLayout>,
    );
    const style = getByTestId("protected-layout").querySelector("style");
    // tenant-lab 共享种子 theme 为对象，seed loader 退化为 "default"
    expect(style?.textContent).toContain('data-tenant="default"');
  });

  it("未设置当前租户 → 不渲染 style（clearTheme）", () => {
    tenantStore.setCurrentTenant(""); // 不存在 id → getCurrentTenant 返回 null
    const { getByTestId } = render(
      <ProtectedLayout themeCss="" currentTenantName={null}>
        <div>child</div>
      </ProtectedLayout>,
    );
    const style = getByTestId("protected-layout").querySelector("style");
    expect(style?.textContent ?? "").toBe("");
  });
});