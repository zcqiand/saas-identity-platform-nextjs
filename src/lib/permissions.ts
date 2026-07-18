/**
 * M03.F01 — 权限码字面量集中地
 *
 * D11 决策：权限码字符串（"user:read" 等），不在独立表。
 * 这里集中定义整套权限码 + 默认分组，避免每个组件都 hardcode 字面量。
 */

export const PERMISSION = {
  USER_READ: "user:read",
  USER_WRITE: "user:write",
  ROLE_READ: "role:read",
  ROLE_WRITE: "role:write",
  TENANT_READ: "tenant:read",
  TENANT_WRITE: "tenant:write",
  AUDIT_READ: "audit:read",
  PLATFORM_ADMIN: "platform:admin",
} as const;

export type PermissionCode = (typeof PERMISSION)[keyof typeof PERMISSION];

export const PERMISSION_GROUPS: Array<{ name: string; permissions: PermissionCode[] }> = [
  {
    name: "user",
    permissions: [PERMISSION.USER_READ, PERMISSION.USER_WRITE],
  },
  {
    name: "role",
    permissions: [PERMISSION.ROLE_READ, PERMISSION.ROLE_WRITE],
  },
  {
    name: "tenant",
    permissions: [PERMISSION.TENANT_READ, PERMISSION.TENANT_WRITE],
  },
  {
    name: "audit",
    permissions: [PERMISSION.AUDIT_READ],
  },
  {
    name: "platform",
    permissions: [PERMISSION.PLATFORM_ADMIN],
  },
];