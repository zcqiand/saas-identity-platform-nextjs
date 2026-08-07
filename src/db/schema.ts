/**
 * PostgreSQL schema（drizzle pg-core）。
 * 由旧 SQLite schema 1:1 翻译：同表名、同列名、同外键。
 * 消费方（store / seed / api route）按表名 import 不变。
 *
 * 翻译约定：
 *   - 自增 integer 主键 → serial().primaryKey()
 *   - 非自增 integer 主键 → integer().primaryKey()（本 schema 无此例）
 *   - text 列保持 text()（不引入 pgEnum，减少噪音）
 *   - integer({ mode: "boolean" }) → boolean()
 *   - 外键统一上提到表第三参 (t) => ({ ... })，列里只留 integer("fk_id")
 *   - default(sql`(datetime('now'))`) → defaultNow()（语义等价，pg 原生）
 */
import { sql } from "drizzle-orm";
import { boolean, foreignKey, integer, pgTable, serial, text } from "drizzle-orm/pg-core";
import { TenantSchema } from "@saas/identity-platform-shared/schemas/tenant";

export const healthCheck = pgTable("health_check", {
  id: serial().primaryKey(),
  ok: integer("ok").notNull(),
  checkedAt: text("checked_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export type HealthCheckRow = typeof healthCheck.$inferSelect;
export type NewHealthCheckRow = typeof healthCheck.$inferInsert;

// @entry M01.F01.I11 类型契约(tenant) — tenants + tenant_users + sso_states 三表
export const tenants = pgTable("tenants", {
  id: serial().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  theme: text("theme").notNull().default("default"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const tenantUsers = pgTable(
  "tenant_users",
  {
    id: serial().primaryKey(),
    tenantId: integer("tenant_id").notNull(),
    userId: integer("user_id").notNull(),
    /** per-tenant role："admin" | "member" | "viewer"（D5 决策） */
    role: text("role").notNull().default("member"),
    joinedAt: text("joined_at")
      .notNull()
      .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  },
  (t) => ({
    tenantFk: foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }).onDelete("cascade"),
    userFk: foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  }),
);

export const ssoStates = pgTable(
  "sso_states",
  {
    id: serial().primaryKey(),
    state: text("state").notNull().unique(),
    code: text("code"),
    tenantId: integer("tenant_id"),
    userId: integer("user_id"),
    expiresAt: text("expires_at").notNull(),
  },
  (t) => ({
    tenantFk: foreignKey({ columns: [t.tenantId], foreignColumns: [tenants.id] }),
  }),
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type TenantUser = typeof tenantUsers.$inferSelect;
export type NewTenantUser = typeof tenantUsers.$inferInsert;
export type SsoState = typeof ssoStates.$inferSelect;
export type NewSsoState = typeof ssoStates.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// M02 schema：users / orgs / positions / position_members
// ─────────────────────────────────────────────────────────────────────────
// @entry M02.F01.I09 组织管理 — 部门资源契约(MSW) — schema 表挂此处
// @entry M02.F02.I09 用户管理 — 用户资源契约(MSW) — schema 表挂此处
// @entry M02.F03.I05 岗位管理 — 删除岗位按钮 — schema 表挂此处（岗位列表底层表）

/** Tenant 字段契约（shared TenantSchema）—— 文档锚点，确保 shared 是字段真相源；
 *  drizzle 字段保持原状以避免 migration churn（SQL 真名切换留待 6.x 主版本）。 */
export type _SharedTenantContract = typeof TenantSchema.shape;

export const users = pgTable("users", {
  id: serial().primaryKey(),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  email: text("email").notNull().unique(),
  /** JSON 字符串数组：["admin", "manager", "member", "viewer"] */
  roles: text("roles").notNull().default('["member"]'),
  /** "active" | "disabled" | "pending" */
  status: text("status").notNull().default("active"),
  createdAt: text("created_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const orgs = pgTable(
  "orgs",
  {
    id: serial().primaryKey(),
    name: text("name").notNull(),
    /** 自引用 FK：orgs.parent_id → orgs.id。删根 → 子节点 SET NULL（变独立根） */
    parentId: integer("parent_id"),
    sort: integer("sort").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  },
  (t) => ({
    parentFk: foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "orgs_parent_fk",
    }).onDelete("set null"),
  }),
);

export const positions = pgTable("positions", {
  id: serial().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  sort: integer("sort").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const positionMembers = pgTable(
  "position_members",
  {
    id: serial().primaryKey(),
    positionId: integer("position_id").notNull(),
    userId: integer("user_id").notNull(),
    joinedAt: text("joined_at")
      .notNull()
      .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  },
  (t) => ({
    positionFk: foreignKey({ columns: [t.positionId], foreignColumns: [positions.id] }).onDelete("cascade"),
    userFk: foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  }),
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

export const roles = pgTable("roles", {
  id: serial().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    id: serial().primaryKey(),
    roleId: integer("role_id").notNull(),
    /** 权限码字符串（"user:read" 等）—— D11 决策：不在独立表 */
    permissionCode: text("permission_code").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  },
  (t) => ({
    roleFk: foreignKey({ columns: [t.roleId], foreignColumns: [roles.id] }).onDelete("cascade"),
  }),
);

export const userGroups = pgTable("user_groups", {
  id: serial().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const userGroupMembers = pgTable(
  "user_group_members",
  {
    id: serial().primaryKey(),
    groupId: integer("group_id").notNull(),
    userId: integer("user_id").notNull(),
    joinedAt: text("joined_at")
      .notNull()
      .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  },
  (t) => ({
    groupFk: foreignKey({ columns: [t.groupId], foreignColumns: [userGroups.id] }).onDelete("cascade"),
    userFk: foreignKey({ columns: [t.userId], foreignColumns: [users.id] }).onDelete("cascade"),
  }),
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;
export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;
export type UserGroup = typeof userGroups.$inferSelect;
export type NewUserGroup = typeof userGroups.$inferInsert;
export type UserGroupMember = typeof userGroupMembers.$inferSelect;
export type NewUserGroupMember = typeof userGroupMembers.$inferInsert;

// M03.F02 权限组（permission_groups）— 权限模板：name + description + permissions(JSON)
// + sort + enabled。roles 通过 role_permissions 关联到 permission_code；权限组是给 UI
// 批量管理权限码的中间层（"管理员权限包" / "只读权限包"），与 roles 表解耦。
export const permissionGroups = pgTable("permission_groups", {
  id: serial().primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  /** JSON 字符串数组：["user:read", "role:write"] — 命名空间由调用方约定 */
  permissions: text("permissions").notNull().default("[]"),
  sort: integer("sort").notNull().default(0),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export type PermissionGroup = typeof permissionGroups.$inferSelect;
export type NewPermissionGroup = typeof permissionGroups.$inferInsert;

// ─────────────────────────────────────────────────────────────────────────
// M04 schema：apps / app_menus / api_keys
// ─────────────────────────────────────────────────────────────────────────
// @entry M04.F01.I07 应用管理 — 跳转菜单管理 — schema 表挂此处
// @entry M04.F01.I12 应用 store actions 内部接口 — schema 表挂此处
// @entry M04.F02.I04 删除 API Key — schema 表挂此处

export const apps = pgTable("apps", {
  id: serial().primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  type: text("type").notNull().default("web"),
  description: text("description"),
  enabled: boolean("enabled").notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export const appMenus = pgTable(
  "app_menus",
  {
    id: serial().primaryKey(),
    appId: integer("app_id").notNull(),
    parentId: integer("parent_id"),
    code: text("code").notNull(),
    name: text("name").notNull(),
    path: text("path").notNull(),
    sort: integer("sort").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: text("created_at")
      .notNull()
      .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  },
  (t) => ({
    appFk: foreignKey({ columns: [t.appId], foreignColumns: [apps.id] }).onDelete("cascade"),
    parentFk: foreignKey({
      columns: [t.parentId],
      foreignColumns: [t.id],
      name: "app_menus_parent_fk",
    }).onDelete("set null"),
  }),
);

export const apiKeys = pgTable(
  "api_keys",
  {
    id: serial().primaryKey(),
    name: text("name").notNull(),
    key: text("key").notNull().unique(),
    appId: integer("app_id").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    expiresAt: text("expires_at").notNull().default("never"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
  },
  (t) => ({
    appFk: foreignKey({ columns: [t.appId], foreignColumns: [apps.id] }).onDelete("cascade"),
  }),
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

export const auditLogs = pgTable("audit_logs", {
  id: serial().primaryKey(),
  /** "login" | "logout" | "create" | "update" | "delete" | "permission_change" */
  action: text("action").notNull(),
  operator: text("operator").notNull(),
  resource: text("resource").notNull(),
  resourceId: text("resource_id").notNull(),
  ip: text("ip").notNull().default("127.0.0.1"),
  detail: text("detail").notNull().default(""),
  timestamp: text("timestamp")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type NewAuditLog = typeof auditLogs.$inferInsert;

// M06 platform_settings (单表 key-value，8 个功能域共用)
// @entry M06.F01.I04 启用登录失败锁定 — schema 表挂此处
// @entry M06.F03.I09 历史密码数量 — schema 表挂此处

export const platformSettings = pgTable("platform_settings", {
  id: serial().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS')`),
});

export type PlatformSetting = typeof platformSettings.$inferSelect;
export type NewPlatformSetting = typeof platformSettings.$inferInsert;
