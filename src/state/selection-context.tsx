"use client";

// Selection Context — 页面级「焦点选中」状态（与 MenuTreePage 应用选择同构）。
//
// localStorage 持久化 schema（每次写入同步）：
//   saas.selected.tenant = JSON { id, name }
//   saas.selected.app    = JSON { id, name }
//
// 选择侧只存 id + name（与「应用选择」一致），具体菜单/租户属性由消费页从
// 各自的 fixture / msw API derive。这样刷新页面/重开浏览器/换设备后都能还原
// 「上次选中的行」。
//
// 默认值（首次访问、未持久化场景）：
//   - 租户 = msw 仓 TENANT_IDS.acme / 名称 "ACME Corp"
//   - 应用 = app-lab / 名称 "建筑工程实验室管理系统"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const TENANT_STORAGE_KEY = "saas.selected.tenant";
const APP_STORAGE_KEY = "saas.selected.app";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_TENANT_NAME = "ACME Corp";
const DEFAULT_APP_ID = "app-lab";
const DEFAULT_APP_NAME = "建筑工程实验室管理系统";

export interface Selection {
  id: string;
  name: string;
}

export interface SelectionContextValue {
  selectedTenant: Selection;
  selectedApp: Selection;
  setSelectedTenant: (s: Selection) => void;
  setSelectedApp: (s: Selection) => void;
}

const SelectionContext = createContext<SelectionContextValue | null>(null);

function loadJSON<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  if (typeof window === "undefined") return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedTenant, setSelectedTenantState] = useState<Selection>(() =>
    loadJSON<Selection>(null, {
      id: DEFAULT_TENANT_ID,
      name: DEFAULT_TENANT_NAME,
    }),
  );
  const [selectedApp, setSelectedAppState] = useState<Selection>(() =>
    loadJSON<Selection>(null, {
      id: DEFAULT_APP_ID,
      name: DEFAULT_APP_NAME,
    }),
  );

  // 客户端 hydrate 后从 localStorage 恢复
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const t = localStorage.getItem(TENANT_STORAGE_KEY);
      if (t) setSelectedTenantState(JSON.parse(t));
    } catch {
      // ignore
    }
    try {
      const a = localStorage.getItem(APP_STORAGE_KEY);
      if (a) setSelectedAppState(JSON.parse(a));
    } catch {
      // ignore
    }
  }, []);

  const setSelectedTenant = useCallback((s: Selection) => {
    setSelectedTenantState(s);
    if (typeof window !== "undefined") {
      localStorage.setItem(TENANT_STORAGE_KEY, JSON.stringify(s));
    }
  }, []);

  const setSelectedApp = useCallback((s: Selection) => {
    setSelectedAppState(s);
    if (typeof window !== "undefined") {
      localStorage.setItem(APP_STORAGE_KEY, JSON.stringify(s));
    }
  }, []);

  const value = useMemo<SelectionContextValue>(
    () => ({ selectedTenant, selectedApp, setSelectedTenant, setSelectedApp }),
    [selectedTenant, selectedApp, setSelectedTenant, setSelectedApp],
  );

  return <SelectionContext.Provider value={value}>{children}</SelectionContext.Provider>;
}

export function useSelection(): SelectionContextValue {
  const ctx = useContext(SelectionContext);
  if (!ctx) throw new Error("useSelection must be used inside <SelectionProvider>");
  return ctx;
}
