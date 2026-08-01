/**
 * M01.F04.I06 - GET /api/sso/authorize 单元测试
 */
import { describe, expect } from "vitest";
import { GET } from "@/app/api/sso/authorize/route";
import { fnTest } from "../fn";

function makeRequest(url: string): Request {
  return new Request(url, { method: "GET" });
}

describe("M01.F04.I06 GET /api/sso/authorize", () => {
  fnTest(["M01.F04.I06"], "缺 client_id → 400", () => {
    return (async () => {
      const res = await GET(
        makeRequest(
          "http://localhost/api/sso/authorize?redirect_uri=http://localhost:3001/sso-callback",
        ),
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toMatch(/client_id/);
    })();
  });

  fnTest(["M01.F04.I06"], "缺 redirect_uri → 400", () => {
    return (async () => {
      const res = await GET(
        makeRequest("http://localhost/api/sso/authorize?client_id=lab-management"),
      );
      expect(res.status).toBe(400);
    })();
  });

  fnTest(["M01.F04.I06"], "redirect_uri 非 http(s) → 400（防 open redirect）", () => {
    return (async () => {
      const res = await GET(
        makeRequest(
          "http://localhost/api/sso/authorize?client_id=lab-management&redirect_uri=javascript:alert(1)",
        ),
      );
      expect(res.status).toBe(400);
    })();
  });

  fnTest(["M01.F04.I06"], "正常 → 302，Location 含 code + state", () => {
    return (async () => {
      const res = await GET(
        makeRequest(
          "http://localhost/api/sso/authorize?client_id=lab-management&redirect_uri=http://localhost:3001/sso-callback&state=abc123",
        ),
      );
      expect(res.status).toBe(302);
      const location = res.headers.get("location") ?? "";
      expect(location).toMatch(/^http:\/\/localhost:3001\/sso-callback\?/);
      expect(location).toMatch(/code=mock-auth-code-/);
      expect(location).toMatch(/state=abc123/);
    })();
  });
});
