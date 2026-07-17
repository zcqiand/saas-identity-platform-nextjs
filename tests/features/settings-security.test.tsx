// @vitest-environment jsdom
import { afterEach, describe, expect, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { SecurityClient } from "@/app/(protected)/settings/security-client";
import { fnTest } from "../fn";

/**
 * M06.F01 登录安全策略（7 个 fn-ID I02-I08 + 页面根 I01）
 * SecurityClient 走通用 SettingsDomainClient：data-fn 挂在每个 row 的编辑按钮上。
 */
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("M06.F01 security page", () => {
  fnTest(
    ["M06.F01.I01", "M06.F01.I02", "M06.F01.I03", "M06.F01.I04", "M06.F01.I05", "M06.F01.I06", "M06.F01.I07", "M06.F01.I08"],
    "页面根 + 7 个 data-fn 挂上（I01-I08 全部）",
    () => {
      const { getByTestId } = render(<SecurityClient />);
      expect(getByTestId("security-page").getAttribute("data-fn")).toBe("M06.F01.I01");
      for (const id of ["I02", "I03", "I04", "I05", "I06", "I07", "I08"]) {
        const el = getByTestId(`security-btn-M06.F01.${id}`);
        expect(el.getAttribute("data-fn")).toBe(`M06.F01.${id}`);
      }
    },
  );
});