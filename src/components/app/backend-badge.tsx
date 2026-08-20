// 后端模式标签（无交互）— 替代 BackendSwitcher（已废弃 — ADR-0014）。
//
// 显示当前 apiMode（来自 NEXT_PUBLIC_API_MODE，部署期 env），仅用于诊断。

import { getApiBaseUrl, getApiMode } from "@/api/backend-config";

export function BackendBadge() {
  const mode = getApiMode();
  const baseUrl = getApiBaseUrl() || "(同源)";
  return (
    <div className="flex flex-col gap-1 px-2 py-1 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-mono text-muted-foreground">backend:</span>
        <strong data-testid="backend-badge">{mode}</strong>
      </div>
      <div className="font-mono text-muted-foreground truncate" title={baseUrl}>
        {baseUrl}
      </div>
    </div>
  );
}