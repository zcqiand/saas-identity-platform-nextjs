// 运行时后端切换器：msw / aspnetcore / springboot
// 放在 sidebar 底部，紧贴版本号，低视觉权重（dev/admin 关注，普通用户不打扰）。
// 直接 dropdown 选；选 aspnetcore / springboot 时可改 baseUrl。

import { useState } from "react";
import { Server } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBackend } from "@/state/backend-context";
import type { BackendMode } from "@/api/backend-config";

const LABELS: Record<BackendMode, string> = {
  msw: "MSW（浏览器内 Mock）",
  aspnetcore: "ASP.NET Core",
  springboot: "Spring Boot",
  "nextjs-self": "Next.js（自身 Route Handler，v0.4.0）",
};

const SHORT: Record<BackendMode, string> = {
  msw: "MSW Mock",
  aspnetcore: "ASP.NET Core",
  springboot: "Spring Boot",
  "nextjs-self": "Next.js Self",
};

export function BackendSwitcher() {
  const { backend, baseUrls, setBackend, setBaseUrl, resetBaseUrls } = useBackend();
  const [editing, setEditing] = useState<BackendMode | null>(null);
  const [draft, setDraft] = useState("");

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
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          data-testid="backend-switcher-trigger"
          data-fn="M03.F01.I01"
          className="w-full justify-start gap-2 text-white/70 hover:text-white hover:bg-white/10 text-xs h-7 px-2"
          title={`当前后端：${LABELS[backend]}`}
        >
          <Server className="h-3.5 w-3.5" />
          {SHORT[backend]}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>后端模式（运行时切换）</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {(Object.keys(LABELS) as BackendMode[]).map((mode) => {
          const active = mode === backend;
          return (
            <DropdownMenuItem
              key={mode}
              onSelect={(e) => {
                e.preventDefault();
                setBackend(mode);
              }}
              data-testid={`backend-option-${mode}`}
              className={active ? "bg-accent" : ""}
            >
              <div className="flex-1">
                <div className="font-medium text-sm">{LABELS[mode]}</div>
                <div className="font-mono text-xs text-muted-foreground truncate">
                  {baseUrls[mode] || "(同源 / worker 拦截)"}
                </div>
              </div>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          自定义 baseUrl
        </DropdownMenuLabel>
        <div className="px-2 pb-2 space-y-2">
          {editing ? (
            <div className="space-y-2">
              <div className="text-xs font-medium">{LABELS[editing]}</div>
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="http://localhost:5000"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditing(null);
                }}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                  取消
                </Button>
                <Button size="sm" onClick={commitEdit}>
                  保存
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {(Object.keys(LABELS) as BackendMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => startEdit(mode)}
                  className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent"
                >
                  <span className="font-medium">{LABELS[mode]}</span>
                  <span className="ml-2 font-mono text-muted-foreground">
                    {baseUrls[mode] || "(空)"}
                  </span>
                </button>
              ))}
              <button
                onClick={() => resetBaseUrls()}
                className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent text-muted-foreground"
              >
                恢复默认 baseUrl
              </button>
            </div>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}