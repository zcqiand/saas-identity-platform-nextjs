// Drizzle schema — 镜像 saas-identity-platform-shared/sql/migrations/V001..V007
//
// 关键约束（见 profiles/nextjs-backend.toml §[stack_rules].forbid + docs/conventions/nextjs-full-stack.md）：
// - 字段名/类型/索引 1:1 镜像 shared SQL（SSOT）
// - 禁止用 `drizzle-kit generate` 产 SQL；shared 是 SSOT
// - 禁止修改本文件后手动编辑 migrations/*.sql；改完跑 `bash scripts/gen-shared.sh`
//
// 注：UUID[] 数组列在 Drizzle 用 `uuid().array()`；TEXT[] 用 `text().array()`；
// PG-native enum 用 `pgEnum` 注册，Drizzle 列挂 `tenantStatus("status")` 引用。

import {
  pgTable,
  pgEnum,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  uniqueIndex,
  index,
  primaryKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ============================================================
// 枚举（与 shared SQL 的 CREATE TYPE 一 一对应；DDL 是 SSOT）
// ============================================================

export const tenantStatusEnum = pgEnum("tenant_status", [
  "active",
  "suspended",
  "archived",
]);

export const userStatusEnum = pgEnum("user_status", [
  "active",
  "invited",
  "suspended",
  "disabled",
]);

export const membershipStatusEnum = pgEnum("membership_status", [
  "active",
  "invited",
  "removed",
]);

export const apiKeyStatusEnum = pgEnum("api_key_status", [
  "active",
  "revoked",
  "expired",
]);

export const appStatusEnum = pgEnum("app_status", [
  "active",
  "disabled",
]);

export const oauthGrantTypeEnum = pgEnum("oauth_grant_type", [
  "authorization_code",
  "refresh_token",
  "client_credentials",
  "password",
]);

export const menuTypeEnum = pgEnum("menu_type", [
  "group",
  "page",
  "action",
]);

export const menuStatusEnum = pgEnum("menu_status", [
  "active",
  "disabled",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "user_created",
  "user_updated",
  "user_deleted",
  "role_assigned",
  "role_revoked",
  "login_success",
  "login_failed",
  "oauth_token_issued",
  "api_key_created",
  "api_key_revoked",
]);

// ============================================================
// 表（V001..V007）
// ============================================================

// V001: tenants
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    status: tenantStatusEnum("status").notNull().default("active"),
    settings: jsonb("settings").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("tenants_code_unique").on(t.code),
    uniqueIndex("idx_tenants_code").on(t.code),
    check("tenants_settings_is_object", sql`settings IS NOT NULL AND jsonb_typeof(settings) = 'object'`),
  ],
);

// V002: users + tenant_memberships
export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    username: varchar("username", { length: 64 }).notNull(),
    email: varchar("email", { length: 255 }).notNull(),
    displayName: varchar("display_name", { length: 255 }),
    status: userStatusEnum("status").notNull().default("invited"),
    passwordHash: varchar("password_hash", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("users_tenant_email_unique").on(t.tenantId, t.email),
    uniqueIndex("users_tenant_username_unique").on(t.tenantId, t.username),
    index("idx_users_tenant_id").on(t.tenantId),
    index("idx_users_email_global").on(t.email),
    check("users_email_format", sql`email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$'`),
  ],
);

export const tenantMemberships = pgTable(
  "tenant_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    roleIds: uuid("role_ids").array().notNull().default(sql`ARRAY[]::UUID[]`),
    status: membershipStatusEnum("status").notNull().default("invited"),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("memberships_user_tenant_unique").on(t.userId, t.tenantId),
    index("idx_memberships_user_id").on(t.userId),
    index("idx_memberships_tenant_id").on(t.tenantId),
    index("idx_memberships_role_ids_gin").using("gin", t.roleIds),
  ],
);

// V003: roles + permissions + role_permissions
export const roles = pgTable(
  "roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("roles_tenant_code_unique").on(t.tenantId, t.code),
    index("idx_roles_tenant_id").on(t.tenantId),
    index("idx_roles_code_global").on(t.code),
  ],
);

export const permissions = pgTable(
  "permissions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 128 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("permissions_code_unique").on(t.code),
  ],
);

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
    permissionId: uuid("permission_id").notNull().references(() => permissions.id, { onDelete: "cascade" }),
    grantedAt: timestamp("granted_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.roleId, t.permissionId] }),
    index("idx_role_permissions_role_id").on(t.roleId),
    index("idx_role_permissions_permission_id").on(t.permissionId),
  ],
);

// V004: api_keys
export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 128 }).notNull(),
    prefix: varchar("prefix", { length: 16 }).notNull(),
    secretHash: varchar("secret_hash", { length: 255 }).notNull(),
    status: apiKeyStatusEnum("status").notNull().default("active"),
    scopes: text("scopes").array().notNull().default(sql`ARRAY[]::TEXT[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("api_keys_tenant_prefix_unique").on(t.tenantId, t.prefix),
    index("idx_api_keys_tenant_id").on(t.tenantId),
    index("idx_api_keys_status").on(t.status),
    index("idx_api_keys_expires_at").on(t.expiresAt),
    index("idx_api_keys_prefix_global").on(t.prefix),
    check(
      "api_keys_revoked_at_consistency",
      sql`(status = 'revoked' AND revoked_at IS NOT NULL) OR (status <> 'revoked')`,
    ),
  ],
);

// V005: apps + menus + role_menu_grants
export const apps = pgTable(
  "apps",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    icon: varchar("icon", { length: 64 }),
    sortOrder: integer("sort_order").notNull().default(0),
    status: appStatusEnum("status").notNull().default("active"),
    clientId: varchar("client_id", { length: 128 }).notNull(),
    clientSecretHash: varchar("client_secret_hash", { length: 255 }),
    redirectUris: text("redirect_uris").array().notNull().default(sql`ARRAY[]::TEXT[]`),
    scopes: text("scopes").array().notNull().default(sql`ARRAY[]::TEXT[]`),
    grantTypes: oauthGrantTypeEnum("grant_types").array().notNull().default(sql`ARRAY[]::oauth_grant_type[]`),
    isFirstParty: boolean("is_first_party").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("apps_code_unique").on(t.code),
    uniqueIndex("apps_client_id_unique").on(t.clientId),
  ],
);

export const menus = pgTable(
  "menus",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    appId: uuid("app_id").notNull().references(() => apps.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),  // 自引用；FK 在 SQL 由 CHECK + 触发器维护，Drizzle 这里只声明 notNull
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    path: varchar("path", { length: 512 }),
    icon: varchar("icon", { length: 64 }),
    type: menuTypeEnum("type").notNull().default("page"),
    sortOrder: integer("sort_order").notNull().default(0),
    status: menuStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("menus_app_code_unique").on(t.appId, t.code),
    index("idx_menus_app_id").on(t.appId),
    index("idx_menus_parent_id").on(t.parentId),
    index("idx_menus_app_type").on(t.appId, t.type),
  ],
);

export const roleMenuGrants = pgTable(
  "role_menu_grants",
  {
    roleId: uuid("role_id").primaryKey().references(() => roles.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    menuIds: uuid("menu_ids").array().notNull().default(sql`ARRAY[]::UUID[]`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_role_menu_grants_tenant_id").on(t.tenantId),
    index("idx_role_menu_grants_menu_ids_gin").using("gin", t.menuIds),
  ],
);

// V006: audit_events + audit_retention_policies
export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: auditActionEnum("action").notNull(),
    targetUserId: uuid("target_user_id").references(() => users.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_audit_events_tenant_occurred").on(t.tenantId, t.occurredAt.desc()),
    index("idx_audit_events_actor").on(t.actorUserId),
    index("idx_audit_events_target").on(t.targetUserId),
    index("idx_audit_events_action").on(t.action),
    index("idx_audit_events_metadata_gin").using("gin", t.metadata),
    check(
      "audit_events_metadata_is_object",
      sql`metadata IS NOT NULL AND jsonb_typeof(metadata) = 'object'`,
    ),
  ],
);

export const auditRetentionPolicies = pgTable(
  "audit_retention_policies",
  {
    tenantId: uuid("tenant_id").primaryKey().references(() => tenants.id, { onDelete: "cascade" }),
    retentionDays: integer("retention_days").notNull().default(90),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "audit_retention_days_positive",
      sql`retention_days >= 1 AND retention_days <= 3650`,
    ),
  ],
);

// ============================================================
// 类型导出（应用层 DTO 映射用；与 orval 生成的端点类型对齐）
// ============================================================

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type TenantMembership = typeof tenantMemberships.$inferSelect;
export type Role = typeof roles.$inferSelect;
export type Permission = typeof permissions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type App = typeof apps.$inferSelect;
export type Menu = typeof menus.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;