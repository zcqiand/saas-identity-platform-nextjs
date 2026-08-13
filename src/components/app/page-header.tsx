import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 页面级标题栏。每个功能页顶部统一走这里，不要各写各的 h2 + 按钮布局。
 * title 左对齐，actions 右对齐（放「新增」等主操作）。
 */
function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export { PageHeader };
