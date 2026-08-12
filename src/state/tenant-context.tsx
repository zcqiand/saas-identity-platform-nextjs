"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export interface TenantContextValue {
  currentTenantId: string | null;
  tenantCode: string | null;
  accessToken: string | null;
  setTenant: (id: string | null, code: string | null, token: string | null) => void;
  clear: () => void;
}

const STORAGE_KEY = "saas.tenant";

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: ReactNode }) {
  const [currentTenantId, setCurrentTenantId] = useState<string | null>(null);
  const [tenantCode, setTenantCode] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      try {
        const v = JSON.parse(raw);
        setCurrentTenantId(v.currentTenantId ?? null);
        setTenantCode(v.tenantCode ?? null);
        setAccessToken(v.accessToken ?? null);
      } catch {}
    }
  }, []);

  const setTenant = useCallback(
    (id: string | null, code: string | null, token: string | null) => {
      setCurrentTenantId(id);
      setTenantCode(code);
      setAccessToken(token);
      if (id && token && typeof window !== "undefined") {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ currentTenantId: id, tenantCode: code, accessToken: token }),
        );
      } else if (typeof window !== "undefined") {
        localStorage.removeItem(STORAGE_KEY);
      }
    },
    [],
  );

  const clear = useCallback(() => setTenant(null, null, null), [setTenant]);

  const value = useMemo<TenantContextValue>(
    () => ({ currentTenantId, tenantCode, accessToken, setTenant, clear }),
    [currentTenantId, tenantCode, accessToken, setTenant, clear],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside <TenantProvider>");
  return ctx;
}