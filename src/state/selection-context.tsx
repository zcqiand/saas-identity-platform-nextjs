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
//   - 应用 = lab-management / 名称 "建筑工程建筑工程实验室管理系统"
//
// CLAUDE.md §2 硬规则：必须 lazy initializer 同步 hydrate，禁止 useState(default) + useEffect(load)
// 反模式（会在首次挂载闪 default 再切到 localStorage 值）。

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

const TENANT_STORAGE_KEY = "saas.selected.tenant";
const APP_STORAGE_KEY = "saas.selected.app";

const DEFAULT_TENANT_ID = "00000000-0000-0000-0000-000000000001";
const DEFAULT_TENANT_NAME = "ACME Corp";
const DEFAULT_APP_ID = "lab-management";
const DEFAULT_APP_NAME = "建筑工程建筑工程实验室管理系统";

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

// 同步读 localStorage；SSR 时无 window 走 default
function readSelection(key: string, fallback: Selection): Selection {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Selection) : fallback;
  } catch {
    return fallback;
  }
}

export function SelectionProvider({ children }: { children: ReactNode }) {
  const [selectedTenant, setSelectedTenantState] = useState<Selection>(() =>
    readSelection(TENANT_STORAGE_KEY, {
      id: DEFAULT_TENANT_ID,
      name: DEFAULT_TENANT_NAME,
    }),
  );
  const [selectedApp, setSelectedAppState] = useState<Selection>(() =>
    readSelection(APP_STORAGE_KEY, {
      id: DEFAULT_APP_ID,
      name: DEFAULT_APP_NAME,
    }),
  );

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
