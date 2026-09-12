// 后端切换器（2026-09-11 用户裁定恢复运行时切换，覆盖 ADR-0014 dev 单 URL）。
// 视觉对齐 TenantSwitcher（DropdownMenu + 图标 + ChevronsUpDown）。
// 选择持久化 localStorage（saas.api.backend），http-client 每次请求动态读取，
// 切完下一个请求即生效，无需刷新。未选择 = env 默认目标。
// variant="sidebar"（默认）：深色侧边栏 footer 用白字样式；
// variant="plain"：浅色背景（登录页卡片）用默认 ghost 样式（2026-09-12）。
"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, Server } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BACKENDS, getSelectedBackend, setSelectedBackend } from "@/api/backend-config";

export function BackendBadge({ variant = "sidebar" }: { variant?: "sidebar" | "plain" }) {
  const [selected, setSelected] = useState(getSelectedBackend());
  const current = BACKENDS.find((b) => b.key === selected);

  function pick(key: string) {
    setSelectedBackend(key);
    setSelected(key);
  }

  return (
    <div
      className={variant === "sidebar" ? "w-full px-2 py-1 text-xs" : "w-full text-xs"}
      data-testid="backend-badge"
    >
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={
              variant === "sidebar"
                ? "w-full justify-between gap-2 border border-white/20 bg-transparent text-white/80 hover:bg-white/10 hover:text-white"
                : "w-full justify-between gap-2 border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }
          >
            <span className="flex min-w-0 items-center gap-2">
              <Server className="h-4 w-4 text-slate-500" />
              <span className="truncate font-medium">{current ? current.key : "(env 默认)"}</span>
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>切换后端</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => pick("")} className="cursor-pointer">
            <Server className="mr-2 h-4 w-4 text-slate-400" />
            <span className="flex-1">env 默认（部署配置）</span>
            {!selected && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
          {BACKENDS.map((b) => (
            <DropdownMenuItem
              key={b.key}
              onSelect={() => pick(b.key)}
              className="cursor-pointer"
            >
              <Server className="mr-2 h-4 w-4 text-slate-500" />
              <div className="flex flex-1 flex-col">
                <span className="font-medium">{b.key}</span>
                <span className="font-mono text-xs text-slate-500">{b.baseUrl}</span>
              </div>
              {selected === b.key && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
