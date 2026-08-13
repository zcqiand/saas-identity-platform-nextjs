import { Button } from "@/components/ui/button";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

/**
 * 分页条。列表页底部统一走这里。受控：page 由调用方持有。
 */
function PaginationBar({
  page,
  totalPages,
  total,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-muted-foreground text-sm">
        {total != null ? `共 ${total} 条 · ` : ""}第 {page} / {totalPages} 页
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeftIcon />
          上一页
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          下一页
          <ChevronRightIcon />
        </Button>
      </div>
    </div>
  );
}

export { PaginationBar };
