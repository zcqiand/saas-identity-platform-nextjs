/**
 * M01.F03.I01 — 认证 store 接口层
 *
 * 服务端 JWT 工具（signSessionToken / verifySessionToken）+ cookie 名常量。
 * 客户端只通过 /api/me/permissions 这类 route handler 间接用，避免把 secret 漏到 client。
 */
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE_NAME = "saas_session";
const SECRET = process.env.SESSION_SECRET ?? "dev-secret-do-not-use-in-prod";

export interface SessionPayload {
  userId: number;
  tenantId: number;
  username: string;
  iat: number;
  exp: number;
}

function base64url(input: Buffer | string): string {
  const b = typeof input === "string" ? Buffer.from(input) : input;
  return b.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function base64urlDecode(input: string): Buffer {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  return Buffer.from(padded + pad, "base64");
}

export function signSessionToken(payload: Omit<SessionPayload, "iat" | "exp">, ttlSeconds = 3600): string {
  const now = Math.floor(Date.now() / 1000);
  const body: SessionPayload = { ...payload, iat: now, exp: now + ttlSeconds };
  const head = { alg: "HS256", typ: "JWT" };
  const headEnc = base64url(JSON.stringify(head));
  const bodyEnc = base64url(JSON.stringify(body));
  const sig = createHmac("sha256", SECRET).update(`${headEnc}.${bodyEnc}`).digest();
  return `${headEnc}.${bodyEnc}.${base64url(sig)}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [headEnc, bodyEnc, sigEnc] = parts as [string, string, string];
  const expected = createHmac("sha256", SECRET).update(`${headEnc}.${bodyEnc}`).digest();
  let actual: Buffer;
  try {
    actual = base64urlDecode(sigEnc);
  } catch {
    return null;
  }
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
  try {
    const payload = JSON.parse(base64urlDecode(bodyEnc).toString("utf-8")) as SessionPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}