import { sql } from "drizzle-orm";
import { sqliteTable, integer, text, foreignKey } from "drizzle-orm/sqlite-core";

/**
 * SQLite 表。
 *
 * 约定：
 *   - 改这张表的列后，跑 `npx drizzle-kit generate` 让它出新迁移。
 *   - 手动编辑 drizzle/000N_*.sql 是禁止的（见项目 CLAUDE.md 禁止事项）。
 *   - 字段命名 snake_case，与 SQL 习惯对齐。
 *   - 业务表到达后新增；目前只放 health_check 让 route handler /api/health 有可读写的表。
 */
export const healthCheck = sqliteTable("health_check", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ok: integer("ok").notNull(),
  checkedAt: text("checked_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export type HealthCheckRow = typeof healthCheck.$inferSelect;
export type NewHealthCheckRow = typeof healthCheck.$inferInsert;

// @entry M01.F01.I11 类型契约(tenant) — tenants + tenant_users + sso_states 三表
export const tenants = sqliteTable("tenants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  theme: text("theme").notNull().default("default"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
});

export const tenantUsers = sqliteTable(
  "tenant_users",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: integer("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** per-tenant role："admin" | "member" | "viewer"（D5 决策） */
    role: text("role").notNull().default("member"),
    joinedAt: text("joined_at").notNull().default(sql`(datetime('now'))`),
  },
);

export const ssoStates = sqliteTable("sso_states", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  state: text("state").notNull().unique(),
  code: text("code"),
  tenantId: integer("tenant_id").references(() => tenants.id),
  userId: integer("user_id"),
  expiresAt: text("expires_at").notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantUser = typeof tenantUsers.$inferSelect;
export type NewTenantUser = typeof tenantUsers.$inferInsert;
export type SsoState = typeof ssoStates.$inferSelect;
export type NewSsoState = typeof ssoStates.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// M02 schema：users / orgs / positions / position_members
// ─────────────────────────────────────────────────────────────────────────
// @entry M02.F01.I09 组织管理 — 组织资源契约(MSW) — schema 表挂此处
// @entry M02.F02.I09 用户管理 — 用户资源契约(MSW) — schema 表挂此处
// @entry M02.F03.I05 岗位管理 — 删除岗位按钮 — schema 表挂此处（岗位列表底层表）

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull().unique(),
  /** JSON 字符串数组：["admin", "manager", "member", "viewer"] */
  roles: text("roles").notNull().default('["member"]'),
  /** "active" | "disabled" | "pending" */
  status: text("status").notNull().default("active"),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const orgs = sqliteTable(
  "orgs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    /** 自引用 FK：orgs.parent_id → orgs.id。删根 → 子节点 SET NULL（变独立根） */
    parentId: integer("parent_id"),
    sort: integer("sort").notNull().default(0),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    parentFk: foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "orgs_parent_fk",
    }).onDelete("set null"),
  }),
);

export const positions = sqliteTable("positions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sort: integer("sort").notNull().default(0),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const positionMembers = sqliteTable(
  "position_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    positionId: integer("position_id")
      .notNull()
      .references(() => positions.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: text("joined_at").notNull().default(sql`(datetime('now'))`),
  },
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Org = typeof orgs.$inferSelect;
export type NewOrg = typeof orgs.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type PositionMember = typeof positionMembers.$inferSelect;
export type NewPositionMember = typeof positionMembers.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// M03 schema：roles / role_permissions / user_groups / user_group_members
// ─────────────────────────────────────────────────────────────────────────
// @entry M03.F01.I09 组织管理 — 权限资源契约(MSW) — schema 表挂此处
// @entry M03.F02.I05 权限组 — 权限组 store 内部接口 — schema 表挂此处
// @entry M03.F03.I05 用户组 — 用户组 store 内部接口 — schema 表挂此处

export const roles = sqliteTable("roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const rolePermissions = sqliteTable(
  "role_permissions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    roleId: integer("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    /** 权限码字符串（"user:read" 等）—— D11 决策：不在独立表 */
    permissionCode: text("permission_code").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
);

export const userGroups = sqliteTable("user_groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const userGroupMembers = sqliteTable(
  "user_group_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    groupId: integer("group_id")
      .notNull()
      .references(() => userGroups.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joinedAt: text("joined_at").notNull().default(sql`(datetime('now'))`),
  },
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type UserGroup = typeof userGroups.$inferSelect;
export type NewUserGroup = typeof userGroups.$inferInsert;
export type UserGroupMember = typeof userGroupMembers.$inferSelect;
export type NewUserGroupMember = typeof userGroupMembers.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// M04 schema：apps / app_menus / api_keys
// ─────────────────────────────────────────────────────────────────────────
// @entry M04.F01.I07 应用管理 — 跳转菜单管理 — schema 表挂此处
// @entry M04.F01.I12 应用 store actions 内部接口 — schema 表挂此处
// @entry M04.F02.I04 删除 API Key — schema 表挂此处

export const apps = sqliteTable("apps", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull().default("web"),
  description: text("description"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export const appMenus = sqliteTable(
  "app_menus",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    parentId: integer("parent_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    path: text("path").notNull(),
    sort: integer("sort").notNull().default(0),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
    updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    parentFk: foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "app_menus_parent_fk",
    }).onDelete("set null"),
  }),
);

export const apiKeys = sqliteTable(
  "api_keys",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    key: text("key").notNull().unique(),
    appId: integer("app_id")
      .notNull()
      .references(() => apps.id, { onDelete: "cascade" }),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    expiresAt: text("expires_at").notNull().default("never"),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
);

export type App = typeof apps.$inferSelect;
export type NewApp = typeof apps.$inferInsert;
export type AppMenu = typeof appMenus.$inferSelect;
export type NewAppMenu = typeof appMenus.$inferInsert;
export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

// M05 audit_logs
// @entry M05.F01.I08 审计 store actions 内部接口
// @entry M05.F01.I09 审计日志资源契约(MSW)

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  /** "login" | "logout" | "create" | "update" | "delete" | "permission_change" */
  action: text("action").notNull(),
  operator: text("operator").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id").notNull(),
  ip: text("ip").notNull().default("127.0.0.1"),
  detail: text("detail").notNull().default(""),
  timestamp: text("timestamp").notNull().default(sql`(datetime('now'))`),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// M06 platform_settings (单表 key-value，8 个功能域共用)
// @entry M06.F01.I04 启用登录失败锁定 — schema 表挂此处
// @entry M06.F03.I09 历史密码数量 — schema 表挂此处

export const platformSettings = sqliteTable("platform_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
});

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type NewPlatformSetting = typeof platformSettings.$inferInsert;
