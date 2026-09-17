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
  apps,
  menus,
  roleMenuGrants,
} from "../../saas-identity-platform-shared/seeds";

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
    mutateAsync: async (vars: { data: any; id?: string; tenantId?: string; clientId?: string; roleId?: string; menuId?: string; keyId?: string; userId?: string }) => ({
      data: { id: vars?.id ?? "new-id", ...(vars?.data ?? {}) },
    }),
    isPending: false,
    reset: () => {},
  };
}

// === JWT signing key for tests（Phase 5 HS256 + jose 要求 ≥32 bytes）===
// ADR-0019：test 期显式 seed,与 dev 同样走 env 注入路径,不依赖生产字面兜底。
// 与 .env.test 保持对齐（saas-springboot SsoBeansConfig @PostConstruct 同样校验）。
process.env.JWT_SIGNING_KEY ??= "dev-key-32-bytes-minimum-length!";
process.env.JWT_ISSUER ??= "saas-identity-platform";
process.env.JWT_AUDIENCE ??= "saas-identity-platform-clients";
process.env.JWT_TTL_SECONDS ??= "3600";
// NEXT_PUBLIC_API_BASE_URL 测试期同源相对 URL 模式（msw/node setupServer 相对路径 handler 匹配）。
process.env.NEXT_PUBLIC_API_BASE_URL ??= "";

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

  tenantApiKeysCreateApiKey: async (_t: string, body: any) => ({ data: { id: "new-key", prefix: "sk_live", status: "active", ...body } }),
  tenantApiKeysRevokeApiKey: async (_t: string, keyId: string) => ({ data: { id: keyId, status: "revoked" } }),
  tenantApiKeysRotateApiKey: async () => ({ data: { id: "rotated-key", prefix: "sk_live", status: "active" } }),

  adminClientsListApps: async () => ({ data: page(apps) }),
  adminClientsCreateApp: async (body: any) => ({ data: { id: "new-app", ...body } }),
  adminClientsGetApp: async (id: string) => ({ data: apps.find((a) => a.id === id) ?? apps[0] }),
  adminClientsUpdateApp: async (clientId: string, body: any) => ({ data: { id: clientId, ...body } }),
  adminClientsDeleteApp: async () => ({ data: undefined }),
  adminClientsSetAppStatus: async () => ({ data: undefined }),

  clientMenusListMenus: async (clientId: string) => ({ data: menus.filter((m) => m.clientId === clientId) }),
  clientMenusCreateMenu: async (_a: string, body: any) => ({ data: { id: "new-menu", ...body } }),
  clientMenusGetMenu: async (_a: string, menuId: string) => ({ data: menus.find((m) => m.id === menuId) ?? menus[0] }),
  clientMenusUpdateMenu: async () => ({ data: undefined }),
  clientMenusDeleteMenu: async () => ({ data: undefined }),
  clientMenusMoveMenu: async () => ({ data: undefined }),
  clientMenusReorderMenus: async () => ({ data: menus }),

  tenantRoleMenusListRoleMenus: async (_t: string, roleId: string) => {
    const g = roleMenuGrants.find((x) => x.roleId === roleId);
    return { data: g ?? { roleId, menuIds: [], updatedAt: new Date().toISOString() } };
  },
  tenantRoleMenusSetRoleMenus: async (_t: string, roleId: string, body: any) => ({
    data: { roleId, menuIds: body.menuIds, updatedAt: new Date().toISOString() },
  }),
  tenantRoleMenusClearRoleMenus: async () => ({ data: undefined }),

  // M00.F05 — tenant applications
  tenantApplicationsListTenantApplications: async () => ({ data: page([]) }),
  tenantApplicationsSubscribeTenantApplication: async (_t: string, body: any) => ({
    data: {
      id: "ta-new",
      tenantId: _t,
      clientId: body.clientId,
      status: 1,
      expireTime: body.expireTime,
      createdAt: new Date().toISOString(),
    },
  }),
  tenantApplicationsUpdateTenantApplication: async (
    _t: string,
    clientId: string,
    body: any,
  ) => ({
    data: {
      id: "ta-1",
      tenantId: _t,
      clientId,
      status: body.status,
      expireTime: body.expireTime,
      createdAt: new Date().toISOString(),
    },
  }),
  tenantApplicationsRemoveTenantApplication: async () => ({ data: undefined }),

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
  useTenantUsersAssignRoles: () => mutationStub(),

  useTenantRolesListRoles: () => queryStub({ data: page(roles) }),
  useTenantRolesCreateRole: () => mutationStub(),
  useTenantRolesGetRole: () => queryStub(roles[0]),
  useTenantRolesUpdateRole: () => mutationStub(),
  useTenantRolesDeleteRole: () => mutationStub(),
  useTenantRolesSetPermissions: () => mutationStub(),

  useTenantApiKeysCreateApiKey: () => mutationStub(),
  useTenantApiKeysRevokeApiKey: () => mutationStub(),
  useTenantApiKeysRotateApiKey: () => mutationStub(),

  useAdminAppsListApps: () => queryStub({ data: page(apps) }),
  useAdminAppsCreateApp: () => mutationStub(),
  useAdminAppsGetApp: () => queryStub(apps[0]),
  useAdminAppsUpdateApp: () => mutationStub(),
  useAdminAppsDeleteApp: () => mutationStub(),
  useAdminAppsSetAppStatus: () => mutationStub(),

  useAdminClientsListClients: () => queryStub({ data: page(apps) }),

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

  // M00.F05 — tenant applications
  useTenantApplicationsListTenantApplications: () => queryStub({ data: page([]) }),
  useTenantApplicationsSubscribeTenantApplication: () => mutationStub(),
  useTenantApplicationsUpdateTenantApplication: () => mutationStub(),
  useTenantApplicationsRemoveTenantApplication: () => mutationStub(),

  useMeWhoami: () => queryStub(users[0]),
  useMeGetMyMenus: () => queryStub({ menus: [] }),
  useMeListMyTenants: () => queryStub([]),
  useMeSwitchTenant: () => mutationStub(),
}));

// 2026-09-11 REQ-003：tenants page 改从真 orval tag 模块 import（barrel 的死桩
// shadow 真函数——export * 后同名重导出，列表恒空）。测试 mock 跟随真源路径。
vi.mock("@/api/endpoints/admin-tenants/admin-tenants", () => ({
  useAdminTenantsGetTenant: (_id?: string) => queryStub({ data: tenants[0] }),
  adminTenantsListTenants: async () => ({ data: page(tenants) }),
  adminTenantsCreateTenant: async (body: any) => ({ data: { id: "new-tenant", ...body } }),
  adminTenantsGetTenant: async (id: string) => ({ data: { id, tenantKey: "acme", name: "ACME", status: "active" } }),
  adminTenantsUpdateTenant: async (id: string, body: any) => ({ data: { id, ...body } }),
  adminTenantsDeleteTenant: async () => ({ data: undefined }),
}));

// 2026-09-11 REQ-2026-005：角色页真源 mock（Sys 系契约字段）
vi.mock("@/api/endpoints/tenant-roles/tenant-roles", () => ({
  useTenantRolesListSysRoles: () => queryStub({ data: page(roles) }),
  useTenantRolesCreateSysRole: () => mutationStub(),
  useTenantRolesUpdateSysRole: () => mutationStub(),
  useTenantRolesDeleteSysRole: () => mutationStub(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

afterEach(() => {
  cleanup();
  // localStorage 仅在 jsdom 环境存在（auth fnTests 用 // @vitest-environment node）
  if (typeof globalThis.localStorage !== "undefined") {
    globalThis.localStorage.clear();
  }
});