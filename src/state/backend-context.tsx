"use client";

// Backend Context — 运行时后端切换（msw / aspnetcore / springboot）。
//
// 设计：
//   - 配置存 localStorage["saas.backend"]
//   - React 树 mount 时 hydrate 进模块级单例（backend-config.ts）
//   - setBackend / setBaseUrl 同步写单例 + localStorage
//   - 非 msw 后端：fetch 走对应 baseUrl；MSW worker 不启用
//   - msw 后端：fetch 同源，worker 拦截
//
// 默认值：msw（dev 下零配置即可跑）。

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BACKEND_DEFAULT_BASE_URLS,
  hydrateBackendConfig,
  snapshotBackendConfig,
  type BackendMode,
} from "@/api/backend-config";

const STORAGE_KEY = "saas.backend";

export interface BackendContextValue {
  backend: BackendMode;
  baseUrl: string;
  baseUrls: Record<BackendMode, string>;
  setBackend: (mode: BackendMode) => void;
  setBaseUrl: (mode: BackendMode, url: string) => void;
  resetBaseUrls: () => void;
}

const BackendContext = createContext<BackendContextValue | null>(null);

interface PersistedConfig {
  backend?: BackendMode;
  baseUrls?: Partial<Record<BackendMode, string>>;
}

function loadPersisted(): PersistedConfig {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as PersistedConfig;
    return {
      backend: parsed.backend,
      baseUrls: parsed.baseUrls,
    };
  } catch {
    return {};
  }
}

function savePersisted(value: PersistedConfig): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
}

export function BackendProvider({ children }: { children: ReactNode }) {
  // 同步从 localStorage hydrate；hydrate 同时把模块级单例（backend-config）也同步刷新，
  // 否则 axios 拦截器拿到的 baseUrl 还是默认 msw
  const initial = (() => {
    const persisted = loadPersisted();
    hydrateBackendConfig(persisted);
    return {
      backend: (persisted.backend ?? "msw") as BackendMode,
      baseUrls: { ...BACKEND_DEFAULT_BASE_URLS, ...(persisted.baseUrls ?? {}) },
    };
  })();

  const [backend, setBackendState] = useState<BackendMode>(initial.backend);
  const [baseUrls, setBaseUrls] = useState<Record<BackendMode, string>>(initial.baseUrls);

  const setBackend = useCallback((mode: BackendMode) => {
    setBackendState(mode);
    import("@/api/backend-config").then(({ setBackend: setSingleton }) => {
      setSingleton(mode);
      const snap = snapshotBackendConfig();
      savePersisted(snap);
    });
  }, []);

  const setBaseUrl = useCallback((mode: BackendMode, url: string) => {
    setBaseUrls((prev) => {
      const next = { ...prev, [mode]: url };
      import("@/api/backend-config").then(({ setBaseUrlFor: setUrl, snapshotBackendConfig: snap }) => {
        setUrl(mode, url);
        savePersisted(snap());
      });
      return next;
    });
  }, []);

  const resetBaseUrls = useCallback(() => {
    setBaseUrls({ ...BACKEND_DEFAULT_BASE_URLS });
    import("@/api/backend-config").then(({ snapshotBackendConfig: snap }) => {
      savePersisted(snap());
    });
  }, []);

  const value = useMemo<BackendContextValue>(
    () => ({
      backend,
      baseUrl: baseUrls[backend],
      baseUrls,
      setBackend,
      setBaseUrl,
      resetBaseUrls,
    }),
    [backend, baseUrls, setBackend, setBaseUrl, resetBaseUrls],
  );

  return <BackendContext.Provider value={value}>{children}</BackendContext.Provider>;
}

export function useBackend(): BackendContextValue {
  const ctx = useContext(BackendContext);
  if (!ctx) throw new Error("useBackend must be used inside <BackendProvider>");
  return ctx;
}