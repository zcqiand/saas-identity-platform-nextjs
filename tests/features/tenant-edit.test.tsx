// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import { TenantEditForm } from "@/app/(protected)/tenants/[id]/tenant-edit-form";
import * as tenantStore from "@/lib/tenant-store";
import { fnTest } from "../fn";

/**
 * M01.F01 租户详情/编辑 — fn-ID M01.F01.I06（页面）+ I07（保存配置按钮）
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  tenantStore.setCurrentTenant(0);
  vi.spyOn(window, "alert").mockImplementation(() => undefined);
});

const acme = {
  id: 1,
  code: "acme",
  name: "Acme Corp",
  theme: "default",
  createdAt: "2026-01-01 00:00:00",
};

describe("M01.F01 tenant edit page", () => {
  fnTest(["M01.F01.I06"], "I06 page root 挂 data-fn M01.F01.I06", () => {
    const { getByTestId } = render(<TenantEditForm tenant={acme} />);
    expect(getByTestId("tenant-edit-page").getAttribute("data-fn")).toBe("M01.F01.I06");
  });

  it("表单预填 tenant 字段（name / theme）", () => {
    const { getByTestId } = render(<TenantEditForm tenant={acme} />);
    expect((getByTestId("name-input") as HTMLInputElement).value).toBe("Acme Corp");
    expect((getByTestId("theme-input") as HTMLInputElement).value).toBe("default");
  });

  it("修改 name 输入框值", () => {
    const { getByTestId } = render(<TenantEditForm tenant={acme} />);
    const nameInput = getByTestId("name-input") as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: "Acme Updated" } });
    expect(nameInput.value).toBe("Acme Updated");
  });

  it("I07 保存按钮挂 data-fn M01.F01.I07", () => {
    const { getByTestId } = render(<TenantEditForm tenant={acme} />);
    expect(getByTestId("save-btn").getAttribute("data-fn")).toBe("M01.F01.I07");
  });

  it("点击保存触发 fetch PUT", async () => {
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ...acme, name: "Acme Updated" }), { status: 200 }),
    );
    const { getByTestId } = render(<TenantEditForm tenant={acme} />);
    fireEvent.change(getByTestId("name-input"), { target: { value: "Acme Updated" } });
    fireEvent.click(getByTestId("save-btn"));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalled();
    });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/tenants/1");
    expect(init.method).toBe("PUT");
    const body = JSON.parse(init.body as string);
    expect(body.name).toBe("Acme Updated");
  });
});