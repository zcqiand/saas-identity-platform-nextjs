// vitest setup — enables React testing library matchers + DOM cleanup + api-client mock + use() unwrap
//
// v0.2.0 nextjs 仓的 page 直接调 `useXxx` orval hooks（不是裸函数包 useQuery），
// 所以 mock 必须返 react-query QueryObserverResult 形态的 stub。
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import {
  tenants,
  users,
  roles,
  apiKeys,
  apps,
  menus,
  roleMenuGrants,
  auditEvents,
} from "@saas/identity-platform-msw/fixtures";

// === Mock React.use() to unwrap params synchronously ===
// Next.js 15 把 params 改成 Promise<{...}>，client component 用 `use(params)` 解包。
// 测试环境下没有 React Server Components context，vi.mock('react') 用真实 + use override。
vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return { ...actual, use: <T,>(p: T) => p };
});

// === Helpers ===
function page<T>(items: T[]) {
  return { items, page: 1, pageSize: items.length, total: items.length };
}

function queryStub<T>(data: T) {
  return {
    data,
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: () => Promise.resolve(),
  };
}

function mutationStub() {
  return {
    mutate: () => {},
    mutateAsync: async (vars: { data: any; id?: string; tenantId?: string; appId?: string; roleId?: string; menuId?: string; keyId?: string; userId?: string }) => ({
      data: { id: vars?.id ?? "new-id", ...(vars?.data ?? {}) },
    }),
    isPending: false,
    reset: () => {},
  };
}

// === Mock local orval api-client (@/api/endpoints/endpoints) ===
// orval 生成的 endpoints.ts 模块同时含裸函数 + useXxx hooks。tests 需要 hooks 形态桩。
vi.mock("@/api/endpoints/endpoints", () => ({
  // --- Bare functions（兼容 useQuery({ queryFn }) 调用）---
  authLogin: async (body: { data: { username: string } }) => ({
    data: {
      accessToken: `mock-jwt-${body.data.username}`,
      refreshToken: "mock-refresh",
      tokenType: "Bearer",
      expiresIn: 3600,
      userId: "u1",
      currentTenantId: "00000000-0000-0000-0000-000000000001",
    },
  }),
  authLogout: async () => ({ data: undefined }),
  adminTenantsListTenants: async () => ({ data: page(tenants) }),
  adminTenantsCreateTenant: async (body: any) => ({ data: { id: "new-tenant", ...body } }),
  adminTenantsGetTenant: async (id: string) => ({ data: { id, code: "acme", name: "ACME", status: "active" } }),
  adminTenantsUpdateTenant: async (id: string, body: any) => ({ data: { id, ...body } }),
  adminTenantsDeleteTenant: async () => ({ data: undefined }),

  tenantUsersListUsers: async () => ({ data: page(users) }),
  tenantUsersCreateUser: async (_t: string, body: any) => ({ data: { id: "new-user", ...body } }),
  tenantUsersGetUser: async () => ({ data: users[0] }),
  tenantUsersUpdateUser: async (_t: string, userId: string, body: any) => ({ data: { id: userId, ...body } }),
  tenantUsersDeleteUser: async () => ({ data: undefined }),

  tenantRolesListRoles: async () => ({ data: page(roles) }),
  tenantRolesCreateRole: async (_t: string, body: any) => ({ data: { id: "new-role", ...body } }),
  tenantRolesGetRole: async () => ({ data: roles[0] }),
  tenantRolesUpdateRole: async (_t: string, roleId: string, body: any) => ({ data: { id: roleId, ...body } }),
  tenantRolesDeleteRole: async () => ({ data: undefined }),
  tenantRolesSetPermissions: async () => ({ data: undefined }),

  tenantApiKeysListApiKeys: async () => ({ data: page(apiKeys) }),
  tenantApiKeysCreateApiKey: async (_t: string, body: any) => ({ data: { id: "new-key", prefix: "sk_live", status: "active", ...body } }),
  tenantApiKeysRevokeApiKey: async (_t: string, keyId: string) => ({ data: { id: keyId, status: "revoked" } }),
  tenantApiKeysRotateApiKey: async () => ({ data: { id: "rotated-key", prefix: "sk_live", status: "active" } }),

  adminAppsListApps: async () => ({ data: page(apps) }),
  adminAppsCreateApp: async (body: any) => ({ data: { id: "new-app", ...body } }),
  adminAppsGetApp: async (id: string) => ({ data: apps.find((a) => a.id === id) ?? apps[0] }),
  adminAppsUpdateApp: async (appId: string, body: any) => ({ data: { id: appId, ...body } }),
  adminAppsDeleteApp: async () => ({ data: undefined }),
  adminAppsSetAppStatus: async () => ({ data: undefined }),

  adminAppMenusListMenus: async (appId: string) => ({ data: menus.filter((m) => m.appId === appId) }),
  adminAppMenusCreateMenu: async (_a: string, body: any) => ({ data: { id: "new-menu", ...body } }),
  adminAppMenusGetMenu: async (_a: string, menuId: string) => ({ data: menus.find((m) => m.id === menuId) ?? menus[0] }),
  adminAppMenusUpdateMenu: async () => ({ data: undefined }),
  adminAppMenusDeleteMenu: async () => ({ data: undefined }),
  adminAppMenusMoveMenu: async () => ({ data: undefined }),
  adminAppMenusReorderMenus: async () => ({ data: menus }),

  tenantRoleMenusListRoleMenus: async (_t: string, roleId: string) => {
    const g = roleMenuGrants.find((x) => x.roleId === roleId);
    return { data: g ?? { roleId, menuIds: [], updatedAt: new Date().toISOString() } };
  },
  tenantRoleMenusSetRoleMenus: async (_t: string, roleId: string, body: any) => ({
    data: { roleId, menuIds: body.menuIds, updatedAt: new Date().toISOString() },
  }),
  tenantRoleMenusClearRoleMenus: async () => ({ data: undefined }),

  tenantAuditListAuditEvents: async () => ({ data: page(auditEvents) }),

  meWhoami: async () => ({ data: users[0] }),
  meGetMyMenus: async () => ({ data: {} }),
  meListMyTenants: async () => ({ data: [] }),
  meSwitchTenant: async () => ({ data: { tenantId: "t1", accessToken: "new" } }),

  // --- useXxx hooks（nextjs 仓的 page 直接调这些）---
  useAuthLogin: () => mutationStub(),

  useAdminTenantsListTenants: () => queryStub({ data: page(tenants) }),
  useAdminTenantsCreateTenant: () => mutationStub(),
  useAdminTenantsGetTenant: () => queryStub(tenants[0]),
  useAdminTenantsUpdateTenant: () => mutationStub(),
  useAdminTenantsDeleteTenant: () => mutationStub(),

  useTenantUsersListUsers: () => queryStub({ data: page(users) }),
  useTenantUsersCreateUser: () => mutationStub(),
  useTenantUsersGetUser: () => queryStub(users[0]),
  useTenantUsersUpdateUser: () => mutationStub(),
  useTenantUsersDeleteUser: () => mutationStub(),

  useTenantRolesListRoles: () => queryStub({ data: page(roles) }),
  useTenantRolesCreateRole: () => mutationStub(),
  useTenantRolesGetRole: () => queryStub(roles[0]),
  useTenantRolesUpdateRole: () => mutationStub(),
  useTenantRolesDeleteRole: () => mutationStub(),
  useTenantRolesSetPermissions: () => mutationStub(),

  useTenantApiKeysListApiKeys: () => queryStub({ data: page(apiKeys) }),
  useTenantApiKeysCreateApiKey: () => mutationStub(),
  useTenantApiKeysRevokeApiKey: () => mutationStub(),
  useTenantApiKeysRotateApiKey: () => mutationStub(),

  useAdminAppsListApps: () => queryStub({ data: page(apps) }),
  useAdminAppsCreateApp: () => mutationStub(),
  useAdminAppsGetApp: () => queryStub(apps[0]),
  useAdminAppsUpdateApp: () => mutationStub(),
  useAdminAppsDeleteApp: () => mutationStub(),
  useAdminAppsSetAppStatus: () => mutationStub(),

  useAdminAppMenusListMenus: () => queryStub({ data: menus }),
  useAdminAppMenusCreateMenu: () => mutationStub(),
  useAdminAppMenusGetMenu: () => queryStub(menus[0]),
  useAdminAppMenusUpdateMenu: () => mutationStub(),
  useAdminAppMenusDeleteMenu: () => mutationStub(),
  useAdminAppMenusMoveMenu: () => mutationStub(),
  useAdminAppMenusReorderMenus: () => mutationStub(),

  useTenantRoleMenusListRoleMenus: () =>
    queryStub({ data: roleMenuGrants[0] ?? { roleId: "r1", menuIds: [], updatedAt: "" } }),
  useTenantRoleMenusSetRoleMenus: () => mutationStub(),
  useTenantRoleMenusClearRoleMenus: () => mutationStub(),

  useTenantAuditListAuditEvents: () => queryStub({ data: page(auditEvents) }),

  useMeWhoami: () => queryStub(users[0]),
  useMeGetMyMenus: () => queryStub({ menus: [] }),
  useMeListMyTenants: () => queryStub([]),
  useMeSwitchTenant: () => mutationStub(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
});