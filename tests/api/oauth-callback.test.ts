/**
 * M01.F04.I07 - POST /api/auth/oauth/callback 单元测试
 */
import { describe, expect } from "vitest";
import { POST } from "@/app/api/auth/oauth/callback/route";
import { verifySsoToken } from "@/lib/sso-jwt";
import { fnTest } from "../fn";

function makeJsonRequest(body: unknown): Request {
  return new Request("http://localhost/api/auth/oauth/callback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("M01.F04.I07 POST /api/auth/oauth/callback", () => {
  fnTest(["M01.F04.I07"], "body 非 JSON → 400", () => {
    return (async () => {
      const res = await POST(
        new Request("http://localhost/api/auth/oauth/callback", {
          method: "POST",
          body: "not-json",
        }),
      );
      expect(res.status).toBe(400);
    })();
  });

  fnTest(["M01.F04.I07"], "缺 code → 400", () => {
    return (async () => {
      const res = await POST(makeJsonRequest({ clientId: "lab-management" }));
      expect(res.status).toBe(400);
    })();
  });

  fnTest(["M01.F04.I07"], "code === 'bad-code' → 401", () => {
    return (async () => {
      const res = await POST(
        makeJsonRequest({ code: "bad-code", clientId: "lab-management" }),
      );
      expect(res.status).toBe(401);
      const body = await res.json();
      expect(body.message).toMatch(/无效授权码/);
    })();
  });

  fnTest(["M01.F04.I07"], "clientId 非 lab-management → 401", () => {
    return (async () => {
      const res = await POST(
        makeJsonRequest({ code: "mock-auth-code-1", clientId: "other-client" }),
      );
      expect(res.status).toBe(401);
    })();
  });

  fnTest(["M01.F04.I07"], "正常 lab-management + mock code → 200 + JWT + user", () => {
    return (async () => {
      const res = await POST(
        makeJsonRequest({ code: "mock-auth-code-test", clientId: "lab-management" }),
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        token: string;
        user: { id: string; departmentId: string; orgId?: string };
      };
      expect(body.token).toBeTruthy();
      expect(body.user.id).toBe("u-lab-01");
      expect(body.user.departmentId).toBe("org-lab-root");
      // v0.3.0 过渡：仍兼容旧 orgId 字段
      expect(body.user.orgId).toBe("org-lab-root");

      const payload = await verifySsoToken(body.token);
      expect(payload).not.toBeNull();
      expect(payload?.appId).toBe("app-lab");
      expect(payload?.tenantId).toBe("tenant-lab");
      expect(payload?.departmentId).toBe("org-lab-root");
      expect(payload?.roles).toContain("role-lab-admin");
      expect(payload?.permissions).toContain("project:read");
    })();
  });
});
