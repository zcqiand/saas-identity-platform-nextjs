"use client";

// 通用树表格控件（v0.5.0，替代 page 内 inline 平铺 + paddingLeft 的伪树形）
//
// 数据模型：T extends { children?: T[] | null } —— 调用方负责把扁平数据构造成树
// （如菜单的 parentId → children）。
//
// 用法：
//   const tree = buildTree(flatMenus);
//   <TreeTable
//     nodes={tree}
//     renderRow={(m, { depth, hasChildren, expanded, onToggle }) => (
//       <TableRow key={m.id}>
//         <TableCell style={{ paddingLeft: 8 + depth * 24 }}>
//           {hasChildren && (
//             <button onClick={onToggle} aria-label={expanded ? "折叠" : "展开"}>
//               {expanded ? <ChevronDown /> : <ChevronRight />}
//             </button>
//           )}
//           {m.name}
//         </TableCell>
//         ...
//       </TableRow>
//     )}
//   />
//
// 状态：默认全部展开；受控 / 非受控都支持（`expanded` + `defaultExpanded`）。
// 排序：稳定按 `sortOrder` 同级排序——调用方在 buildTree 前 sort 即可。

import { Fragment, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TreeNode {
  children?: TreeNode[] | null;
}

export interface TreeRowMeta {
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  onToggle: () => void;
}

interface TreeTableProps<T extends TreeNode> {
  /** 已构造好的树（root 节点列表） */
  nodes: T[];
  /** 稳定 id getter（用于 React key + expanded state） */
  getRowId: (node: T) => string;
  /** 单行渲染；(node, meta) => ReactNode（应当返回 <TableRow>） */
  renderRow: (node: T, meta: TreeRowMeta) => ReactNode;
  /** 默认展开的 row id 集合；"all" = 全展开（默认）；空 Set = 全折叠 */
  defaultExpanded?: Set<string> | "all";
  /** 受控 expanded 状态（与 onExpandedChange 配对） */
  expanded?: Set<string>;
  onExpandedChange?: (next: Set<string>) => void;
  /** 空数据占位（无行时整块显示） */
  emptyState?: ReactNode;
}

function flattenVisible<T extends TreeNode>(
  nodes: T[],
  getRowId: (n: T) => string,
  expanded: Set<string>,
  depth = 0,
  out: Array<T & { __depth: number; __hasChildren: boolean; __id: string }> = [],
): typeof out {
  for (const n of nodes) {
    const hasChildren = !!(n.children && n.children.length);
    const id = getRowId(n);
    out.push(Object.assign(n, { __depth: depth, __hasChildren: hasChildren, __id: id }));
    if (hasChildren && expanded.has(id)) {
      flattenVisible(n.children as T[], getRowId, expanded, depth + 1, out);
    }
  }
  return out;
}

/** 收集所有节点 id（用于"全展开"默认） */
function collectAllIds<T extends TreeNode>(
  nodes: T[],
  getRowId: (n: T) => string,
): Set<string> {
  const out = new Set<string>();
  function walk(arr: T[]) {
    for (const n of arr) {
      out.add(getRowId(n));
      if (n.children?.length) walk(n.children as T[]);
    }
  }
  walk(nodes);
  return out;
}

/**
 * 把扁平列表（带 parentId）构造成带 children 的树（按 sortOrder 同级稳定排序）。
 * 调用方负责 sortOrder / parentId 字段存在（tree-table 自身不约束）。
 */
export function buildTree<T extends { id: string; parentId?: string | null; sortOrder?: number }>(
  flat: T[],
): Array<T & { children: T[] }> {
  // strip 任何已有 children（避免 flat 输入里出现循环引用）
  const safe = flat.map((m) => ({ ...m })) as Array<T & { children: T[] }>;
  const map = new Map<string, T & { children: T[] }>();
  safe.forEach((m) => {
    m.children = [];
    map.set(m.id, m);
  });
  const roots: Array<T & { children: T[] }> = [];
  safe.forEach((m) => {
    if (m.parentId && map.has(m.parentId)) {
      map.get(m.parentId)!.children.push(m);
    } else {
      roots.push(m);
    }
  });
  // 同级按 sortOrder 排序（null/undefined 视作 0）
  function sortRec(nodes: T[]) {
    (nodes as Array<T & { sortOrder?: number }>).sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.id.localeCompare(b.id),
    );
    nodes.forEach((n) => {
      const children = (n as unknown as { children?: T[] }).children;
      if (children?.length) sortRec(children);
    });
  }
  sortRec(roots);
  return roots;
}

/** Toggle 图标组件（让调用方不用每次 import lucide） */
export function TreeToggleIcon({ expanded, className }: { expanded: boolean; className?: string }) {
  return expanded ? (
    <ChevronDown className={cn("h-4 w-4", className)} />
  ) : (
    <ChevronRight className={cn("h-4 w-4", className)} />
  );
}

/**
 * 树形表格渲染器。
 *
 * 输出：<TableRow> 元素数组（Fragment 包裹）。调用方应把它放进
 * <Table><TableBody>{treeTable}</TableBody></Table>——HTML 规定 <tr>
 * 必须在 <tbody>/<thead> 里，不能套 <div>，否则 React 会报 hydration error。
 *
 * @example
 *   <Table>
 *     <TableHeader>...</TableHeader>
 *     <TableBody>
 *       <TreeTable nodes={tree} getRowId={m => m.id} renderRow={...} />
 *     </TableBody>
 *   </Table>
 */
export function TreeTable<T extends TreeNode>({
  nodes,
  getRowId,
  renderRow,
  defaultExpanded = "all",
  expanded: controlledExpanded,
  onExpandedChange,
}: TreeTableProps<T>) {
  // 非受控：默认全展开（"all"）。受控时由父级管理 expanded。
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(
    () => (defaultExpanded === "all" ? collectAllIds(nodes, getRowId) : new Set(defaultExpanded)),
  );
  const isControlled = controlledExpanded !== undefined;
  const expanded = isControlled ? controlledExpanded : internalExpanded;

  const visible = useMemo(
    () => flattenVisible(nodes, getRowId, expanded),
    [nodes, getRowId, expanded],
  );

  function toggle(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    if (!isControlled) setInternalExpanded(next);
    onExpandedChange?.(next);
  }

  if (visible.length === 0) return null;

  return (
    <Fragment>
      {visible.map((node) => {
        const meta: TreeRowMeta = {
          depth: node.__depth,
          hasChildren: node.__hasChildren,
          expanded: expanded.has(node.__id),
          onToggle: () => toggle(node.__id),
        };
        // React key 必须放在最外层 wrapper；renderRow 必须返回带 key 的元素
        return <Fragment key={node.__id}>{renderRow(node, meta)}</Fragment>;
      })}
    </Fragment>
  );
}