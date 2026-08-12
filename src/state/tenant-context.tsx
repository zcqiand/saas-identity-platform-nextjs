"use client";

// Tenant Context — 当前租户 + 当前用户 + JWT holder。
//
// 存储字段：
//   currentTenantId / tenantCode / accessToken / refreshToken / user
//
// 默认值 = null（首次加载未登录）。路由守卫（RequireAuth）据此
// 决定是否重定向到 /login。

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface AuthUser {
  id: string;
  username: string;
  email?: string;
}

export interface TenantContextValue {
  currentTenantId: string | null;
  tenantCode: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  /** 已认证（accessToken 非空） */
  isAuthenticated: boolean;
  /** 用 /auth/login 响应填全字段（access + refresh + user + currentTenant） */
  login: (payload: {
    accessToken: string;
    refreshToken: string;
    userId: string;
    username: string;
    email?: string;
    currentTenantId: string;
    tenantCode?: string | null;
  }) => void;
  /** 调 /auth/logout，清 localStorage，重置 state */
  logout: () => Promise<void>;
  /** 直接覆盖 tenant（不调后端），用于跨租户切换 */
  setTenant: (id: string | null, code: string | null, token: string | null) => void;
  clear: () => void;
}

const STORAGE_KEY = "saas.tenant";

interface PersistedSession {
  currentTenantId: string | null;
  tenantCode: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
}

const TenantContext = createContext<TenantContextValue | null>(null);

function emptySession(): PersistedSession {
  return {
    currentTenantId: null,
    tenantCode: null,
    accessToken: null,
    refreshToken: null,
    user: null,
  };
}

function loadSession(): PersistedSession {
  if (typeof window === "undefined") return emptySession();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptySession();
    const parsed = JSON.parse(raw) as PersistedSession;
    return {
      currentTenantId: parsed.currentTenantId ?? null,
      tenantCode: parsed.tenantCode ?? null,
      accessToken: parsed.accessToken ?? null,
      refreshToken: parsed.refreshToken ?? null,
      user: parsed.user ?? null,
    };
  } catch {
    return emptySession();
  }
}

function saveSession(s: PersistedSession): void {
  if (typeof window === "undefined") return;
  if (!s.accessToken || !s.user) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function TenantProvider({ children }: { children: ReactNode }) {
  // 同步从 localStorage hydrate：避免首屏渲染用空 session，导致 RequireAuth
  // 在 hydrate 完成前误判未认证并重定向 /login
  const [session, setSession] = useState<PersistedSession>(() => loadSession());

  const persist = useCallback((next: PersistedSession) => {
    setSession(next);
    saveSession(next);
  }, []);

  const login = useCallback<TenantContextValue["login"]>(
    (payload) => {
      const next: PersistedSession = {
        currentTenantId: payload.currentTenantId,
        tenantCode: payload.tenantCode ?? null,
        accessToken: payload.accessToken,
        refreshToken: payload.refreshToken,
        user: {
          id: payload.userId,
          username: payload.username,
          email: payload.email,
        },
      };
      persist(next);
    },
    [persist],
  );

  const logout = useCallback(async () => {
    const token = session.accessToken;
    if (token) {
      try {
        const { apiRequest } = await import("@/api/http-client");
        await apiRequest("/api/v1/auth/logout", { method: "POST" }, token);
      } catch {
        // best-effort
      }
    }
    persist(emptySession());
  }, [persist, session.accessToken]);

  const setTenant = useCallback(
    (id: string | null, code: string | null, token: string | null) => {
      persist({
        ...session,
        currentTenantId: id,
        tenantCode: code,
        accessToken: token ?? session.accessToken,
      });
    },
    [persist, session],
  );

  const clear = useCallback(() => {
    persist(emptySession());
  }, [persist]);

  const value = useMemo<TenantContextValue>(
    () => ({
      currentTenantId: session.currentTenantId,
      tenantCode: session.tenantCode,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
      isAuthenticated: Boolean(session.accessToken && session.user),
      login,
      logout,
      setTenant,
      clear,
    }),
    [session, login, logout, setTenant, clear],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>");
  return ctx;
}