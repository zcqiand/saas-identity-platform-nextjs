// @vitest-environment jsdom
import { afterEach, describe, expect, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { Home } from "@/components/app/home-client";
import { fnTest } from "../fn";

/**
 * M01.F05 控制台首页 — Home 组件（fn-ID M01.F05.I01, I03）
 *
 * 覆盖：
 *   - I01 仪表盘页面：3 张卡渲染、3 个数字、data-fn 锚点、标题"仪表盘"
 *   - I03 卡片点击跳转：3 张卡分别 link 到 /tenants /users /orgs
 *   - I02 聚合查询：本文件不直接测（用 dashboard-store.test.ts 覆盖）；这里只验 props 接口
 *
 * 实现注意：Home 接收 `counts` props（不再硬编码 mock 数据）。
 * 数据从 src/lib/dashboard-store.ts:getDashboardCounts() 来，server component
 * src/app/page.tsx 调好后透传下来。
 *
 * 不用 @testing-library/jest-dom（本项目没装），assertion 用 vitest 原生 toMatch / textContent。
 */

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const sampleCounts = { tenants: 3, users: 5, todayLogins: 2 };

describe("M01.F05.I01 dashboard page", () => {
  fnTest(["M01.F05.I01"], "I01 页面根挂 data-fn=\"M01.F05.I01\"", () => {
    const { getByTestId } = render(<Home counts={sampleCounts} />);
    expect(getByTestId("dashboard-page").getAttribute("data-fn")).toBe("M01.F05.I01");
  });

  fnTest(["M01.F05.I01"], "渲染 3 张卡（3 个 link）", () => {
    const { getAllByRole } = render(<Home counts={sampleCounts} />);
    // 每张卡是一个 <a> 包裹
    const links = getAllByRole("link");
    expect(links.length).toBe(3);
  });

  fnTest(["M01.F05.I01"], "3 张卡分别有 '租户数' / '用户总数' / '今日登录数' 标题", () => {
    const { getByTestId } = render(<Home counts={sampleCounts} />);
    expect(getByTestId("dashboard-card-tenants").textContent).toMatch(/租户数/);
    expect(getByTestId("dashboard-card-users").textContent).toMatch(/用户总数/);
    expect(getByTestId("dashboard-card-logins").textContent).toMatch(/今日登录数/);
  });

  fnTest(["M01.F05.I01"], "3 张卡显示对应数字（3 / 5 / 2）", () => {
    const { getByTestId } = render(<Home counts={sampleCounts} />);
    expect(getByTestId("dashboard-card-tenants-value").textContent).toBe("3");
    expect(getByTestId("dashboard-card-users-value").textContent).toBe("5");
    expect(getByTestId("dashboard-card-logins-value").textContent).toBe("2");
  });

  fnTest(["M01.F05.I01"], "页面标题是 '仪表盘'（不再渲染旧的 '项目管理'）", () => {
    const { getByTestId } = render(<Home counts={sampleCounts} />);
    expect(getByTestId("dashboard-page").textContent).toContain("仪表盘");
    expect(getByTestId("dashboard-page").textContent).not.toContain("项目管理");
    expect(getByTestId("dashboard-page").textContent).not.toContain("混凝土抗压");
    expect(getByTestId("dashboard-page").textContent).not.toContain("钢筋焊接");
  });

  fnTest(["M01.F05.I01"], "I01 页面根 data-fn 锚点存在（M01.F05.I01）", () => {
    const { getByTestId } = render(<Home counts={sampleCounts} />);
    expect(getByTestId("dashboard-page").getAttribute("data-fn")).toBe("M01.F05.I01");
  });

  fnTest(["M01.F05.I03"], "I03 data-fn 锚点在 3 张卡（Link）上", () => {
    const { getAllByRole } = render(<Home counts={sampleCounts} />);
    const links = getAllByRole("link");
    expect(links.length).toBe(3);
    for (const link of links) {
      expect(link.getAttribute("data-fn")).toBe("M01.F05.I03");
    }
  });

  // ---------- M01.F05.I03 卡片点击跳转 ----------

  fnTest(["M01.F05.I03"], "租户卡是 Link，href 指向 /tenants", () => {
    const { getByTestId } = render(<Home counts={sampleCounts} />);
    expect(getByTestId("dashboard-card-tenants").getAttribute("href")).toBe("/tenants");
  });

  fnTest(["M01.F05.I03"], "用户卡是 Link，href 指向 /users", () => {
    const { getByTestId } = render(<Home counts={sampleCounts} />);
    expect(getByTestId("dashboard-card-users").getAttribute("href")).toBe("/users");
  });

  fnTest(["M01.F05.I03"], "登录卡是 Link，href 指向 /audit-logs（M05 上线后回链）", () => {
    const { getByTestId } = render(<Home counts={sampleCounts} />);
    // M05.F01 审计日志页上线后，登录卡从临时占位 /orgs 回链到 /audit-logs
    expect(getByTestId("dashboard-card-logins").getAttribute("href")).toBe("/audit-logs");
  });
});
