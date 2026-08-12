"use client";

// 运行时后端切换器：msw / aspnetcore / springboot
// 放在 sidebar 底部，紧贴版本号，低视觉权重（dev/admin 关注，普通用户不打扰）。
// 直接 dropdown 选；选 aspnetcore / springboot 时可改 baseUrl。
//
// v0.2.0 nextjs 仓：plain CSS 实现（未引入 shadcn/ui；其他 React 仓可用 shadcn DropdownMenu）。

import { useState } from "react";
import { useBackend } from "@/state/backend-context";
import type { BackendMode } from "@/api/backend-config";

const LABELS: Record<BackendMode, string> = {
  msw: "MSW（浏览器内 Mock）",
  aspnetcore: "ASP.NET Core",
  springboot: "Spring Boot",
};

const SHORT: Record<BackendMode, string> = {
  msw: "MSW Mock",
  aspnetcore: "ASP.NET Core",
  springboot: "Spring Boot",
};

export function BackendSwitcher() {
  const { backend, baseUrls, setBackend, setBaseUrl, resetBaseUrls } = useBackend();
  const [editing, setEditing] = useState<BackendMode | null>(null);
  const [draft, setDraft] = useState("");
  const [open, setOpen] = useState(false);

  function startEdit(mode: BackendMode) {
    setEditing(mode);
    setDraft(baseUrls[mode]);
  }

  function commitEdit() {
    if (editing) {
      const trimmed = draft.trim().replace(/\/+$/, "");
      if (trimmed) setBaseUrl(editing, trimmed);
    }
    setEditing(null);
  }

  return (
    <div
      data-testid="backend-switcher"
      style={{
        padding: "8px 12px",
        borderTop: "1px solid #eee",
        fontSize: 12,
        color: "#555",
        position: "relative",
      }}
    >
      <button
        data-testid="backend-switcher-trigger"
        data-fn="M03.F01.I01"
        onClick={() => setOpen((o) => !o)}
        style={{
          width: "100%",
          padding: "4px 8px",
          border: "1px solid #ccc",
          borderRadius: 4,
          background: "#fff",
          cursor: "pointer",
          textAlign: "left",
        }}
        title={`当前后端：${LABELS[backend]}`}
      >
        ⚙ {SHORT[backend]}
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 12,
            right: 12,
            background: "#fff",
            border: "1px solid #ccc",
            borderRadius: 4,
            padding: 8,
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            zIndex: 100,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 6 }}>后端模式（运行时切换）</div>
          {(Object.keys(LABELS) as BackendMode[]).map((mode) => {
            const active = mode === backend;
            return (
              <button
                key={mode}
                data-testid={`backend-option-${mode}`}
                data-fn="M03.F01.I01"
                onClick={() => setBackend(mode)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "4px 6px",
                  border: 0,
                  borderRadius: 4,
                  background: active ? "#1f2937" : "transparent",
                  color: active ? "#fff" : "#333",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <div style={{ fontWeight: 500, fontSize: 13 }}>{LABELS[mode]}</div>
                <div style={{ fontFamily: "monospace", fontSize: 11, color: active ? "#cbd5e1" : "#888" }}>
                  {baseUrls[mode] || "(同源 / worker 拦截)"}
                </div>
              </button>
            );
          })}
          <hr style={{ margin: "8px 0", border: 0, borderTop: "1px solid #eee" }} />
          <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>自定义 baseUrl</div>
          {editing ? (
            <div>
              <div style={{ fontSize: 11, fontWeight: 500 }}>{LABELS[editing]}</div>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="http://localhost:5000"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditing(null);
                }}
                style={{ width: "100%", padding: "2px 6px", border: "1px solid #ccc", borderRadius: 4 }}
              />
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 4, marginTop: 4 }}>
                <button onClick={() => setEditing(null)} style={{ padding: "2px 8px" }}>
                  取消
                </button>
                <button onClick={commitEdit} style={{ padding: "2px 8px" }}>
                  保存
                </button>
              </div>
            </div>
          ) : (
            <div>
              {(Object.keys(LABELS) as BackendMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => startEdit(mode)}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "2px 4px",
                    border: 0,
                    borderRadius: 4,
                    background: "transparent",
                    textAlign: "left",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  <span style={{ fontWeight: 500 }}>{LABELS[mode]}</span>
                  <span style={{ marginLeft: 6, fontFamily: "monospace", color: "#888" }}>
                    {baseUrls[mode] || "(空)"}
                  </span>
                </button>
              ))}
              <button
                onClick={() => resetBaseUrls()}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "2px 4px",
                  border: 0,
                  background: "transparent",
                  textAlign: "left",
                  fontSize: 11,
                  color: "#888",
                  cursor: "pointer",
                }}
              >
                恢复默认 baseUrl
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}