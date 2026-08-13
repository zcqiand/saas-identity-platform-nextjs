import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * 列表加载态。数据未就绪时统一用这个，禁止渲染空表/空态（会把"加载中"误读成"无数据"）。
 * 用法：`{list.isPending ? <LoadingState /> : items.length === 0 ? <EmptyState .../> : <Table/>}`
 */
function LoadingState({
  className,
  label = "加载中…",
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 px-6 py-12 text-sm text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export { LoadingState };
