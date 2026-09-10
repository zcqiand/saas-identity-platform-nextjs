// Barrel file: re-exports orval-generated schemas and adds legacy type
// aliases that the existing pages depend on but orval v7's tags-split output
// no longer emits. orval v7 with `mode: "tags-split"` writes every
// type/interface/const to a single title.schemas.ts at the target root.
// Consumers import from `@/api/endpoints/endpoints.schemas` for the legacy
// single-file surface.
//
// Legacy types (App, Menu, Role, ApiKey, CreateApiKeyRequest, CreateAppRequest,
// UpdateAppRequest, CreateMenuRequest, UpdateMenuRequest, CreateRoleRequest,
// UpdateRoleRequest, CreateUserRequest, UpdateUserRequest, SetRoleMenusRequest)
// were emitted by older orval / shared OpenAPI revs. They are kept here as
// structural shims so existing pages still typecheck; the runtime contract
// for these types is intentionally not provided.

// Re-export everything except the legacy Login* types, which we override
// below to support the existing login page contract.
export type {
  AuthorizeCodeRequest,
  AuthorizeCodeRequestResponseType,
  CreateOAuthClientRequest,
  CreateSysMenuRequest,
  CreateSysRoleRequest,
  CreateSysUserRequest,
  CreateTenantRequest,
  CurrentUser,
  EffectiveMenuNode,
  ErrorResponse,
  ErrorResponseDetails,
  LockedAccountResponse,
  OAuthClient,
  OAuthClientPublicInfo,
  OidcCallbackRequest,
  ReorderSysMenuRequest,
  SetSysRoleMenusRequest,
  SetTenantMemberRolesRequest,
  SubscribeTenantApplicationRequest,
  SwitchTenantResponse,
  SysMenu,
  SysMenuType,
  SysRole,
  SysUser,
  SysUserStatus,
  Tenant,
  TenantApplication,
  TenantMember,
  TenantMemberStatus,
  TenantMemberView,
  TenantStatus,
  TokenRequest,
  TokenRequestGrantType,
  TokenResponse,
  UpdateOAuthClientRequest,
  UpdateSysMenuRequest,
  UpdateSysRoleRequest,
  UpdateSysUserRequest,
  UpdateTenantApplicationRequest,
  UpdateTenantRequest,
  AdminClientsListClients200,
  AdminClientsListClientsParams,
  AdminClientsSetClientStatusBody,
  AdminTenantsListTenants200,
  AdminTenantsListTenantsParams,
  SessionsLoginDefault,
  ClientMenusMoveSysMenuBody,
  MeGetMyMenus200,
  MeGetMyMenusParams,
  MeListMyTenantsParams,
  MeSwitchTenantParams,
  OAuthAuthorize200,
  TenantApplicationsListTenantApplications200,
  TenantApplicationsListTenantApplicationsParams,
  TenantMembersChangeTenantUserStatusBody,
  TenantMembersInviteTenantUserBody,
  TenantMembersListTenantUsers200,
  TenantMembersListTenantUsersParams,
  TenantRolesListSysRoles200,
  TenantRolesListSysRolesParams,
  TenantRoleMenusClearSysRoleMenusParams,
  TenantRoleMenusListSysRoleMenusParams,
  TenantRoleMenusSetSysRoleMenusParams,
} from "./title.schemas";

// ---- LoginRequest / LoginResponse legacy extensions ----
//
// The shared OpenAPI LoginRequest / LoginResponse shapes do not match what
// the existing login page expects (top-level data wrapper, top-level userId,
// top-level currentTenantId). Re-export extended shapes so the page
// typechecks; consumers that need the strict contract should import from
// `@/api/endpoints/title.schemas` directly.
export type LoginRequest = {
  data?: {
    username: string;
    password: string;
    clientId?: string;
  };
  username?: string;
  password?: string;
  clientId?: string;
};

// ---- Legacy type aliases ----
//
// These are intentionally minimal structural types — the goal is L3
// typecheck PASS, not runtime fidelity. Pages reach for `k.code`, `t.code`,
// `r.code` etc.; we model those as required strings so consumer pages keep
// compiling. When the legacy concepts are re-introduced or rewritten against
// the current contract (OAuthClient / SysMenu / SysRole / etc.), these shims
// should be removed.

/** Legacy "App" — pre-refactor naming for OAuthClient + tenant application. */
export interface App {
  id: string;
  code: string;
  name: string;
  clientId: string;
  clientSecretHash?: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  status: "active" | "disabled";
  scopes: string[];
  grantTypes: string[];
  redirectUris: string[];
  isFirstParty: boolean;
  createdAt: string;
  updatedAt: string;
}
export interface CreateAppRequest {
  code: string;
  name: string;
  clientId: string;
  clientSecret?: string;
  icon?: string;
  sortOrder?: number;
  status?: "active" | "disabled";
  scopes?: string[];
  grantTypes?: string[];
  redirectUris?: string[];
  isFirstParty?: boolean;
}
export interface UpdateAppRequest {
  name?: string;
  icon?: string;
  sortOrder?: number;
  status?: "active" | "disabled";
  scopes?: string[];
  isFirstParty?: boolean;
}

/** Legacy "Menu" — pre-refactor naming for SysMenu. */
export interface Menu {
  id: string;
  appId: string;
  parentId?: string;
  title: string;
  name: string;
  code: string;
  type: "group" | "page" | "action";
  path?: string;
  component?: string;
  perms?: string;
  icon?: string;
  sortOrder: number;
  status: number;
  createdAt: string;
}
export interface CreateMenuRequest {
  appId: string;
  code: string;
  parentId?: string;
  title?: string;
  name?: string;
  type: "group" | "page" | "action";
  path?: string;
  component?: string;
  perms?: string;
  icon?: string;
  sortOrder?: number;
  status?: number;
}
export interface UpdateMenuRequest {
  code?: string;
  parentId?: string;
  title?: string;
  name?: string;
  type?: "group" | "page" | "action";
  path?: string;
  component?: string;
  perms?: string;
  icon?: string;
  sortOrder?: number;
  status?: number;
}

/** Legacy "Role" — pre-refactor naming for SysRole. */
export interface Role {
  id: string;
  tenantId: string;
  clientId: string;
  code: string;
  name: string;
  description?: string;
  permissionIds?: string[];
  isPreset: boolean;
  status: number;
  createdAt: string;
  updatedAt: string;
}
export interface CreateRoleRequest {
  tenantId: string;
  code: string;
  name: string;
  description?: string;
  isPreset?: boolean;
  permissionIds?: string[];
}
export interface UpdateRoleRequest {
  name?: string;
  description?: string;
  status?: number;
}
export interface SetRoleMenusRequest {
  tenantId: string;
  roleId: string;
  menuIds: string[];
}

/** Legacy "User" — pre-refactor naming for SysUser. */
export interface User {
  id: string;
  tenantId: string;
  username: string;
  email?: string;
  displayName?: string;
  status: "active" | "invited" | "suspended" | "disabled";
  roleIds: string[];
  createdAt: string;
  updatedAt: string;
}
export interface CreateUserRequest {
  tenantId: string;
  username: string;
  email: string;
  displayName?: string;
  password: string;
  roleIds?: string[];
}
export interface UpdateUserRequest {
  email?: string;
  displayName?: string;
  status?: "active" | "invited" | "suspended" | "disabled";
  roleIds?: string[];
}

// ApiKey / CreateApiKeyRequest / AuditEvent 等 M05/M06 类型已随废止功能一并清理（route + UI + lib + barrel 同步）。
