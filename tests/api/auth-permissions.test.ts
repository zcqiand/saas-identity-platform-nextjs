/**
 * M01.F04.I08 - GET /api/auth/permissions 单元测试
 */
import { describe, expect } from "vitest";
import { GET } from "@/app/api/auth/permissions/route";
import { signSsoToken } from "@/lib/sso-jwt";
import { fnTest } from "../fn";

async function makeAuthedRequest(orgId: string, token?: string): Promise<Request> {
  const url = `http://localhost/api/auth/permissions?orgId=${encodeURIComponent(orgId)}`;
  const headers: Record<string, string> = {};
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(url, { method: "GET", headers });
}

describe("M01.F04.I08 GET /api/auth/permissions", () => {
  fnTest(["M01.F04.I08"], "缺 Bearer → 401", () => {
    return (async () => {
      const res = await GET(await makeAuthedRequest("org-lab-root"));
      expect(res.status).toBe(401);
    })();
  });

  fnTest(["M01.F04.I08"], "Bearer 无效 → 401", () => {
    return (async () => {
      const res = await GET(await makeAuthedRequest("org-lab-root", "garbage.token.here"));
      expect(res.status).toBe(401);
    })();
  });

  fnTest(["M01.F04.I08"], "orgId 非 org-lab-root → 403", () => {
    return (async () => {
      const token = await signSsoToken({
        sub: "u-test",
        username: "test",
        displayName: "Test",
        orgId: "org-lab-root",
        tenantId: "tenant-lab",
        appId: "app-lab",
        roles: ["role-lab-admin"],
        permissions: ["project:read"],
      });
      const res = await GET(await makeAuthedRequest("org-other", token));
      expect(res.status).toBe(403);
    })();
  });

  fnTest(["M01.F04.I08"], "正常 → 200 + roles + permissions", () => {
    return (async () => {
      const token = await signSsoToken({
        sub: "u-lab-admin",
        username: "labadmin",
        displayName: "Lab Admin",
        orgId: "org-lab-root",
        tenantId: "tenant-lab",
        appId: "app-lab",
        roles: ["role-lab-admin"],
        permissions: ["project:read", "sample:write", "report:issue"],
      });
      const res = await GET(await makeAuthedRequest("org-lab-root", token));
      expect(res.status).toBe(200);
      const body = (await res.json()) as {
        roles: { id: string; name: string; permissions: string[] }[];
        permissions: string[];
      };
      expect(body.roles).toHaveLength(1);
      const role = body.roles[0];
      expect(role?.id).toBe("role-lab-admin");
      expect(role?.permissions).toContain("project:read");
      expect(body.permissions).toContain("report:issue");
    })();
  });
});
