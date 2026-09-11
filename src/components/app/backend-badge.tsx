// 后端切换器（2026-09-11 用户裁定恢复运行时切换，覆盖 ADR-0014 dev 单 URL）。
// 选择持久化 localStorage（saas.api.backend），http-client 每次请求动态读取，
// 切完下一个请求即生效，无需刷新。env 未选择时显示 env 默认目标。
"use client";

import { useState } from "react";
import { BACKENDS, getApiBaseUrl, getSelectedBackend, setSelectedBackend } from "@/api/backend-config";

export function BackendBadge() {
  const [selected, setSelected] = useState(getSelectedBackend());
  const baseUrl = getApiBaseUrl() || "(同源)";

  return (
    <div className="flex flex-col gap-1 px-2 py-1 text-xs">
      <div className="flex items-center gap-2">
        <span className="font-mono text-muted-foreground">backend:</span>
        <select
          data-testid="backend-badge"
          value={selected}
          onChange={(e) => {
            setSelectedBackend(e.target.value);
            setSelected(e.target.value);
          }}
          className="rounded border bg-background px-1 py-0.5 font-mono text-xs"
        >
          <option value="">(env 默认)</option>
          {BACKENDS.map((b) => (
            <option key={b.key} value={b.key}>
              {b.key} · {b.baseUrl}
            </option>
          ))}
        </select>
      </div>
      <div className="font-mono text-muted-foreground truncate" title={baseUrl}>
        {baseUrl}
      </div>
    </div>
  );
}
