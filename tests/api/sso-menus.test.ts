/**
 * M01.F04.I09 - GET /api/sso/menus 单元测试
 */
import { describe, expect } from "vitest";
import { GET } from "@/app/api/sso/menus/route";
import { LAB_MENUS } from "@/lib/lab-seed";
import { fnTest } from "../fn";

function makeRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

describe("M01.F04.I09 GET /api/sso/menus", () => {
  fnTest(["M01.F04.I09"], "缺 appId → 400", () => {
    return (async () => {
      const res = await GET(makeRequest("http://localhost/api/sso/menus"));
      expect(res.status).toBe(400);
    })();
  });

  fnTest(["M01.F04.I09"], "appId 非 app-lab → 400", () => {
    return (async () => {
      const res = await GET(makeRequest("http://localhost/api/sso/menus?appId=other"));
      expect(res.status).toBe(400);
    })();
  });

  fnTest(["M01.F04.I09"], "正常 → 200，返回 LAB_MENUS 子集", () => {
    return (async () => {
      const res = await GET(makeRequest("http://localhost/api/sso/menus?appId=app-lab"));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        id: string;
        parentId: string | null;
        path: string;
      }[];
      // 端点 /api/sso/menus 不做 enabled 过滤（lab 端 use-menus 拿全量后按 permission 过滤；
      // enabled 是路由实现状态，lab 端 sidebar 用它决定是否挂「规划」徽标，不做硬过滤）
      expect(body.length).toBe(LAB_MENUS.length);
      expect(body.find((m) => m.id === "m-lab-dash")?.parentId).toBeNull();
      // 合同管理移到 grp-res（资源管理）以对齐 lab-React REF
      expect(body.find((m) => m.id === "m-contracts")?.parentId).toBe("grp-res");
    })();
  });
});
