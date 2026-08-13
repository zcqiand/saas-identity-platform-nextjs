import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * 空态。列表无数据、搜索无结果时统一走这里，禁止直接甩一句"暂无数据"的裸文本。
 */
function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {icon && <div className="text-muted-foreground [&_svg]:size-10">{icon}</div>}
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="text-muted-foreground text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export { EmptyState };
