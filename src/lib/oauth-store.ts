// OAuth 2.0 in-memory store — 镜像 saas-identity-platform-msw/src/handlers-extra.ts:41-48
//
// 进程内 Map：OAuth code 一次性 + refresh token rotation。
// Phase 6 替换为 Redis（TTL 后台清理 + 多进程共享 + 重启恢复）。
//
// 用法（Route Handler 内）：
//   import { oauthStore } from "@/lib/oauth-store";
//   oauthStore.putCode(code, { appId, userId, tenantId, scope, redirectUri });
//   const entry = oauthStore.consumeCode(code);   // 一次性
//   oauthStore.putRefresh(refresh, { appId, userId, tenantId, scope });
//   const entry = oauthStore.rotateRefresh(rt);   // 旋转（旧删新发由 caller）

import "server-only";

interface CodeEntry {
  appId: string;
  userId: string;
  tenantId: string;
  scope: string;
  redirectUri: string;
  createdAt: number;
}

interface RefreshEntry {
  appId: string;
  userId: string;
  tenantId: string;
  scope: string;
  createdAt: number;
}

function evictExpired(map: Map<string, { createdAt: number }>, ttlSec: number, now: number): void {
  for (const [k, v] of map) {
    if (now - Math.floor(v.createdAt / 1000) > ttlSec) map.delete(k);
  }
}

function readCodeTtl(): number {
  const raw = process.env.OAUTH_CODE_TTL;
  const n = raw ? Number(raw) : 600;
  return Number.isFinite(n) && n > 0 ? n : 600;
}

function readRefreshTtl(): number {
  const raw = process.env.OAUTH_REFRESH_TTL;
  const n = raw ? Number(raw) : 604800;
  return Number.isFinite(n) && n > 0 ? n : 604800;
}

class OAuthStore {
  private codes = new Map<string, CodeEntry>();
  private refreshTokens = new Map<string, RefreshEntry>();

  putCode(code: string, e: Omit<CodeEntry, "createdAt">): void {
    this.codes.set(code, { ...e, createdAt: Date.now() });
  }

  consumeCode(code: string): CodeEntry | undefined {
    this.evictCodes();
    const e = this.codes.get(code);
    if (e) this.codes.delete(code);
    return e;
  }

  putRefresh(token: string, e: Omit<RefreshEntry, "createdAt">): void {
    this.refreshTokens.set(token, { ...e, createdAt: Date.now() });
  }

  rotateRefresh(token: string): RefreshEntry | undefined {
    this.evictRefreshes();
    const e = this.refreshTokens.get(token);
    if (e) this.refreshTokens.delete(token);
    return e;
  }

  private evictCodes(): void {
    evictExpired(this.codes, readCodeTtl(), Math.floor(Date.now() / 1000));
  }

  private evictRefreshes(): void {
    evictExpired(this.refreshTokens, readRefreshTtl(), Math.floor(Date.now() / 1000));
  }
}

// Module-scope singleton（同一进程内共享；Next.js dev hot-reload 下 reset 行为参见 next dev 文档）
export const oauthStore = new OAuthStore();

/** 生成一次性 code 字符串（saas-code-${ts}-${rand}，与 msw handler-extra.ts:370 对齐） */
export function generateAuthCode(): string {
  return `saas-code-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

/** 生成 OAuth access token（saas-jwt-${userId}-${nonce}，与 msw handler-extra.ts:439 对齐） */
export function generateAccessToken(userId: string): string {
  return `saas-jwt-${userId}-${Math.random().toString(36).slice(2)}`;
}

/** 生成 OAuth refresh token（saas-rt-${userId}-${nonce}-${rand}，与 msw handler-extra.ts:440 对齐） */
export function generateRefreshToken(userId: string): string {
  return `saas-rt-${userId}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}