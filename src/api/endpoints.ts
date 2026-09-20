// Barrel file: re-exports orval-generated endpoint modules + provides legacy
// alias hooks/types that the existing pages depend on but orval v7's tags-split
// output no longer emits.
//
// orval v7 with `mode: "tags-split"` generates one file per OpenAPI tag under
// src/api/endpoints/<tag>/<tag>.ts. The legacy single-file convention used
// src/api/endpoints/endpoints.ts; this barrel restores that import surface
// without changing orval config.
//
// Legacy hook aliases (useAdminApps*, useAdminAppMenus*, useTenantApiKeys*,
// useTenantAudit*, useTenantUsers*, authLogin, ...) and legacy type aliases
// (App, Menu, Role, ApiKey, CreateApiKeyRequest, ...) were emitted by orval
// v6 / shared OpenAPI revs that pre-dated the current shared contracts
// (admin-clients / client-menus / tenant-members / tenant-roles /
// tenant-role-menus). They are kept here as no-op type shims so that the
// existing pages still typecheck; runtime behaviour for these legacy hooks
// is intentionally not implemented in this barrel.
//
// Sections:
//  1. orval v7 generated exports (tag files)
//  2. Legacy hook aliases (no-op QueryClient stub)
//  3. Legacy type aliases (re-typed against current schemas where possible)

// ---- 1. orval v7 generated exports ----
export * from "./endpoints/admin-clients/admin-clients";
export * from "./endpoints/admin-tenants/admin-tenants";
export * from "./endpoints/auth/auth";
export * from "./endpoints/client-menus/client-menus";
export * from "./endpoints/clients/clients";
export * from "./endpoints/me/me";
export * from "./endpoints/oauth/oauth";
export * from "./endpoints/tenant-applications/tenant-applications";
export * from "./endpoints/tenant-members/tenant-members";
export * from "./endpoints/tenant-role-menus/tenant-role-menus";
export * from "./endpoints/tenant-roles/tenant-roles";

// Note: `adminTenantsListTenants` is re-exported both by orval's
// admin-tenants tag file and by our legacy stub below. TypeScript
// preserves the later declaration, so callers get the any-typed stub.
// (See legacy hook aliases section.)

// ---- Legacy 层已删除（2026-09-11 B 扫尾，用户裁定）----
// 此前本文件在手写 legacy alias 段定义了与 per-tag 真源同名的空实现（TS 本地导出
// 优先遮蔽 re-export），导致成员页/应用页/菜单页列表恒空而单测全绿。
// 规则：本文件只保留上面的 `export * from` 真源 re-export；
// 新增 API 改 shared tsp → orval 重生；禁止再添加任何手写函数或类型 shim。
