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
export * from "./admin-clients/admin-clients";
export * from "./admin-tenants/admin-tenants";
export * from "./auth/auth";
export * from "./client-menus/client-menus";
export * from "./clients/clients";
export * from "./me/me";
export * from "./oauth/oauth";
export * from "./tenant-applications/tenant-applications";
export * from "./tenant-members/tenant-members";
export * from "./tenant-role-menus/tenant-role-menus";
export * from "./tenant-roles/tenant-roles";

// Note: `adminTenantsListTenants` is re-exported both by orval's
// admin-tenants tag file and by our legacy stub below. TypeScript
// preserves the later declaration, so callers get the any-typed stub.
// (See legacy hook aliases section.)

// ---- 2. Legacy hook aliases ----
// react-query mutation / query observer result shims. Pages that import these
// legacy hooks expect the same shape as orval's useXxx: a stub returning
// { data, mutateAsync, isPending, refetch, ... }. The shim returns
// `undefined` data so the page renders the loading/empty state until a real
// implementation lands.
type LegacyQueryStub = {
  data: { data: any } | undefined;
  isPending: boolean;
  isLoading: boolean;
  isError: boolean;
  error: null;
  refetch: () => Promise<unknown>;
};
type LegacyMutationStub = {
  mutate: (vars: unknown) => void;
  mutateAsync: (vars: unknown) => Promise<unknown>;
  isPending: boolean;
  reset: () => void;
};
function legacyQueryStub(payload: any = undefined): LegacyQueryStub {
  return {
    data: { data: payload },
    isPending: false,
    isLoading: false,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
}
function legacyMutationStub(): LegacyMutationStub {
  return {
    mutate: () => {},
    mutateAsync: async () => undefined,
    isPending: false,
    reset: () => {},
  };
}

// Auth
export const authLogin = async (_body: unknown) => ({ data: undefined });

// Admin tenants (legacy names mirror orval's bare functions)
export const adminTenantsListTenants = async () => ({ data: { items: [] as any[], page: 0, pageSize: 0, total: 0 } });
export const adminTenantsGetTenant = async (_id: string) => ({ data: undefined as any });
export const adminTenantsCreateTenant = async (_body: unknown) => ({ data: undefined });
export const adminTenantsUpdateTenant = async (_id: string, _body: unknown) => ({ data: undefined });
export const adminTenantsDeleteTenant = async (_id: string) => ({ data: undefined });

// Admin apps (legacy naming: useAdminApps* — current contract uses AdminClients)
export const useAdminAppsListApps = () =>
  legacyQueryStub({ items: [] as any[], page: 0, pageSize: 0, total: 0 });
export const useAdminAppsGetApp = (_id?: string) => legacyQueryStub(undefined);
export const useAdminAppsCreateApp = () => legacyMutationStub();
export const useAdminAppsUpdateApp = () => legacyMutationStub();
export const useAdminAppsDeleteApp = () => legacyMutationStub();
export const useAdminAppsSetAppStatus = () => legacyMutationStub();

// Admin app menus (legacy: useAdminAppMenus* — current contract uses ClientMenus)
export const adminAppMenusListMenus = async (_appId: string) => ({ data: [] });
export const useAdminAppMenusListMenus = (_appId?: string) => legacyQueryStub([]);
export const useAdminAppMenusGetMenu = (_a?: string, _m?: string) => legacyQueryStub(undefined);
export const useAdminAppMenusCreateMenu = () => legacyMutationStub();
export const useAdminAppMenusUpdateMenu = () => legacyMutationStub();
export const useAdminAppMenusDeleteMenu = () => legacyMutationStub();
export const useAdminAppMenusMoveMenu = () => legacyMutationStub();
export const useAdminAppMenusReorderMenus = () => legacyMutationStub();

// Tenant users (legacy: useTenantUsers* — current contract uses TenantMembers)
export const useTenantUsersListUsers = (_tenantId?: string) =>
  legacyQueryStub({ items: [] as any[], page: 0, pageSize: 0, total: 0 });
export const useTenantUsersGetUser = (_t?: string, _u?: string) => legacyQueryStub(undefined);
export const useTenantUsersCreateUser = () => legacyMutationStub();
export const useTenantUsersUpdateUser = () => legacyMutationStub();
export const useTenantUsersDeleteUser = () => legacyMutationStub();
export const useTenantUsersAssignRoles = () => legacyMutationStub();

// Tenant roles (legacy: useTenantRoles*Xxx without "Sys")
export const useTenantRolesListRoles = (_tenantId?: string) =>
  legacyQueryStub({ items: [] as any[], page: 0, pageSize: 0, total: 0 });
export const useTenantRolesGetRole = (_t?: string, _r?: string) => legacyQueryStub(undefined);
export const useTenantRolesCreateRole = () => legacyMutationStub();
export const useTenantRolesUpdateRole = () => legacyMutationStub();
export const useTenantRolesDeleteRole = () => legacyMutationStub();

// Tenant role menus (legacy: useTenantRoleMenus*RoleMenus)
export const useTenantRoleMenusListRoleMenus = (_t?: string, _r?: string) =>
  legacyQueryStub({ roleId: "", menuIds: [], updatedAt: "" });
export const useTenantRoleMenusSetRoleMenus = () => legacyMutationStub();
export const useTenantRoleMenusClearRoleMenus = () => legacyMutationStub();