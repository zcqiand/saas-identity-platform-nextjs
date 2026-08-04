# conventions/

本目录**不进主上下文**，只在 skill 明确引用时读取。
这是渐进披露的下半段：SKILL.md 是索引，这里是细节。

一个文件一个主题，顶部三行内说清「什么时候读我」，超 300 行就拆。

---

**与 REF `output/saas-identity-platform/docs/conventions/` 字段一一对应**：字段名、排版顺序、列表列、表单分区，Next.js 一律向 REF 看齐。

REF 现有内容（按需拷贝到本目录或本仓沿用）：

- `app-ui.md` —— shadcn/ui 复合原语使用细则（Button / Dialog / Form / Table）。**Next.js 同源使用**（shadcn/ui 同样适用）。
- `react-perf.md` —— React 性能细则（memo / useMemo / useCallback 使用规则）。**Next.js 部分适用**（Server Components 默认不 re-render；client 组件仍按 React 性能规则）。
- `saas-book-conventions.md` —— 视图层 / 状态管理 / 路由 / 鉴权 / MSW mock 规则。Next.js 同源使用。

Next.js 侧额外细则（按需补）：

- Server Component 默认；client 组件首行加 `'use client'`
- 数据获取走 server action 或 `src/app/api/` route handler；client 组件禁止内联 fetch
- Drizzle ORM over SQLite（dev）；生产走 PostgreSQL + 同源 schema
- shadcn/ui 原语（`src/components/ui/`）+ app 级复合（`src/components/app/`）
