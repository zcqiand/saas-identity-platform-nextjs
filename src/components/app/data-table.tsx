import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/app/empty-state";
import { cn } from "@/lib/utils";

export interface Column<T> {
  /** 表头文案 */
  header: React.ReactNode;
  /** 单元格渲染。给函数完全自定义，或给 keyof T 直接取字段 */
  cell: (row: T) => React.ReactNode;
  className?: string;
  headClassName?: string;
}

/**
 * 统一的数据表格。内建三态：loading 出骨架屏、空数据出 EmptyState、有数据出表。
 * 每个列表页都走这里，禁止各自手写 <table> 和"加载中…"。
 */
function DataTable<T>({
  columns,
  data,
  loading = false,
  rowKey,
  empty,
  onRowClick,
  className,
}: {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  rowKey: (row: T) => React.Key;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
  className?: string;
}) {
  if (loading) {
    return (
      <div className="rounded-lg border">
        <Table className={className}>
          <TableHeader>
            <TableRow>
              {columns.map((col, i) => (
                <TableHead key={i} className={col.headClassName}>
                  {col.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, r) => (
              <TableRow key={r}>
                {columns.map((_, c) => (
                  <TableCell key={c}>
                    <Skeleton className="h-4 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return <>{empty ?? <EmptyState title="暂无数据" />}</>;
  }

  return (
    <div className="rounded-lg border">
      <Table className={className}>
        <TableHeader>
          <TableRow>
            {columns.map((col, i) => (
              <TableHead key={i} className={col.headClassName}>
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(onRowClick && "cursor-pointer")}
            >
              {columns.map((col, i) => (
                <TableCell key={i} className={col.className}>
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export { DataTable };
