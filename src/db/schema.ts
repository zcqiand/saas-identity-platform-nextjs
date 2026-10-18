import {
  bigint,
  boolean,
  check,
  foreignKey,
  index,
  integer,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const drizzleMigrations = pgTable(
  "__drizzle_migrations",
  {
    id: serial().primaryKey().notNull(),
    hash: text().notNull(),
    // You can use { mode: "bigint" } if numbers are exceeding js number limitations
    createdAt: bigint("created_at", { mode: "number" }),
  },
  (table) => {
    return {
      drizzleMigrationsIdNotNull: check("__drizzle_migrations_id_not_null", sql`NOT NULL id`),
      drizzleMigrationsHashNotNull: check("__drizzle_migrations_hash_not_null", sql`NOT NULL hash`),
    };
  },
);

export const oauthAccessToken = pgTable(
  "oauth_access_token",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    tokenId: varchar("token_id", { length: 128 }).notNull(),
    accessToken: text("access_token").notNull(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    userId: uuid("user_id"),
    tenantId: uuid("tenant_id"),
    scope: varchar({ length: 255 }),
    tokenType: varchar("token_type", { length: 32 }).default("Bearer").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    revoked: boolean().default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      idxAccessTokenExpires: index("idx_access_token_expires").using(
        "btree",
        table.expiresAt.asc().nullsLast(),
      ),
      idxAccessTokenUserTenant: index("idx_access_token_user_tenant").using(
        "btree",
        table.userId.asc().nullsLast(),
        table.tenantId.asc().nullsLast(),
      ),
      ukAccessTokenId: uniqueIndex("uk_access_token_id").using(
        "btree",
        table.tokenId.asc().nullsLast(),
      ),
      oauthAccessTokenClientIdOauthClientClientIdFk: foreignKey({
        columns: [table.clientId],
        foreignColumns: [oauthClient.clientId],
        name: "oauth_access_token_client_id_oauth_client_client_id_fk",
      }).onDelete("cascade"),
      oauthAccessTokenUserIdSysUserIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [sysUser.id],
        name: "oauth_access_token_user_id_sys_user_id_fk",
      }).onDelete("set null"),
      oauthAccessTokenTenantIdTenantIdFk: foreignKey({
        columns: [table.tenantId],
        foreignColumns: [tenant.id],
        name: "oauth_access_token_tenant_id_tenant_id_fk",
      }).onDelete("set null"),
      oauthAccessTokenIdNotNull: check("oauth_access_token_id_not_null", sql`NOT NULL id`),
      oauthAccessTokenTokenIdNotNull: check(
        "oauth_access_token_token_id_not_null",
        sql`NOT NULL token_id`,
      ),
      oauthAccessTokenAccessTokenNotNull: check(
        "oauth_access_token_access_token_not_null",
        sql`NOT NULL access_token`,
      ),
      oauthAccessTokenClientIdNotNull: check(
        "oauth_access_token_client_id_not_null",
        sql`NOT NULL client_id`,
      ),
      oauthAccessTokenTokenTypeNotNull: check(
        "oauth_access_token_token_type_not_null",
        sql`NOT NULL token_type`,
      ),
      oauthAccessTokenExpiresAtNotNull: check(
        "oauth_access_token_expires_at_not_null",
        sql`NOT NULL expires_at`,
      ),
      oauthAccessTokenRevokedNotNull: check(
        "oauth_access_token_revoked_not_null",
        sql`NOT NULL revoked`,
      ),
      oauthAccessTokenCreatedAtNotNull: check(
        "oauth_access_token_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
    };
  },
);

export const oauthClient = pgTable(
  "oauth_client",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    clientSecret: varchar("client_secret", { length: 255 }).notNull(),
    clientName: varchar("client_name", { length: 128 }).notNull(),
    grantTypes: varchar("grant_types", { length: 255 }).notNull(),
    redirectUris: text("redirect_uris").notNull(),
    scopes: varchar({ length: 255 }),
    accessTokenValidity: integer("access_token_validity").default(7200).notNull(),
    refreshTokenValidity: integer("refresh_token_validity").default(2592000).notNull(),
    autoApprove: boolean("auto_approve").default(false).notNull(),
    status: smallint().default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      ukOauthClientId: unique("uk_oauth_client_id").on(table.clientId),
      oauthClientIdNotNull: check("oauth_client_id_not_null", sql`NOT NULL id`),
      oauthClientClientIdNotNull: check("oauth_client_client_id_not_null", sql`NOT NULL client_id`),
      oauthClientClientSecretNotNull: check(
        "oauth_client_client_secret_not_null",
        sql`NOT NULL client_secret`,
      ),
      oauthClientClientNameNotNull: check(
        "oauth_client_client_name_not_null",
        sql`NOT NULL client_name`,
      ),
      oauthClientGrantTypesNotNull: check(
        "oauth_client_grant_types_not_null",
        sql`NOT NULL grant_types`,
      ),
      oauthClientRedirectUrisNotNull: check(
        "oauth_client_redirect_uris_not_null",
        sql`NOT NULL redirect_uris`,
      ),
      oauthClientAccessTokenValidityNotNull: check(
        "oauth_client_access_token_validity_not_null",
        sql`NOT NULL access_token_validity`,
      ),
      oauthClientRefreshTokenValidityNotNull: check(
        "oauth_client_refresh_token_validity_not_null",
        sql`NOT NULL refresh_token_validity`,
      ),
      oauthClientAutoApproveNotNull: check(
        "oauth_client_auto_approve_not_null",
        sql`NOT NULL auto_approve`,
      ),
      oauthClientStatusNotNull: check("oauth_client_status_not_null", sql`NOT NULL status`),
      oauthClientCreatedAtNotNull: check(
        "oauth_client_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      oauthClientUpdatedAtNotNull: check(
        "oauth_client_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const oauthCode = pgTable(
  "oauth_code",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    code: varchar({ length: 128 }).notNull(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    userId: uuid("user_id").notNull(),
    tenantId: uuid("tenant_id").notNull(),
    redirectUri: varchar("redirect_uri", { length: 500 }),
    scope: varchar({ length: 255 }),
    codeChallenge: varchar("code_challenge", { length: 128 }),
    codeChallengeMethod: varchar("code_challenge_method", { length: 16 }),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      idxOauthCodeClientUserTenant: index("idx_oauth_code_client_user_tenant").using(
        "btree",
        table.clientId.asc().nullsLast(),
        table.userId.asc().nullsLast(),
        table.tenantId.asc().nullsLast(),
      ),
      idxOauthCodeExpires: index("idx_oauth_code_expires").using(
        "btree",
        table.expiresAt.asc().nullsLast(),
      ),
      ukOauthCode: uniqueIndex("uk_oauth_code").using("btree", table.code.asc().nullsLast()),
      oauthCodeClientIdOauthClientClientIdFk: foreignKey({
        columns: [table.clientId],
        foreignColumns: [oauthClient.clientId],
        name: "oauth_code_client_id_oauth_client_client_id_fk",
      }).onDelete("cascade"),
      oauthCodeUserIdSysUserIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [sysUser.id],
        name: "oauth_code_user_id_sys_user_id_fk",
      }).onDelete("cascade"),
      oauthCodeTenantIdTenantIdFk: foreignKey({
        columns: [table.tenantId],
        foreignColumns: [tenant.id],
        name: "oauth_code_tenant_id_tenant_id_fk",
      }).onDelete("cascade"),
      oauthCodeIdNotNull: check("oauth_code_id_not_null", sql`NOT NULL id`),
      oauthCodeCodeNotNull: check("oauth_code_code_not_null", sql`NOT NULL code`),
      oauthCodeClientIdNotNull: check("oauth_code_client_id_not_null", sql`NOT NULL client_id`),
      oauthCodeUserIdNotNull: check("oauth_code_user_id_not_null", sql`NOT NULL user_id`),
      oauthCodeTenantIdNotNull: check("oauth_code_tenant_id_not_null", sql`NOT NULL tenant_id`),
      oauthCodeExpiresAtNotNull: check("oauth_code_expires_at_not_null", sql`NOT NULL expires_at`),
      oauthCodeCreatedAtNotNull: check("oauth_code_created_at_not_null", sql`NOT NULL created_at`),
    };
  },
);

export const oauthRefreshToken = pgTable(
  "oauth_refresh_token",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    refreshToken: varchar("refresh_token", { length: 128 }).notNull(),
    accessTokenId: uuid("access_token_id").notNull(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    userId: uuid("user_id"),
    tenantId: uuid("tenant_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "string" }).notNull(),
    revoked: boolean().default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      idxRefreshTokenAccessId: index("idx_refresh_token_access_id").using(
        "btree",
        table.accessTokenId.asc().nullsLast(),
      ),
      idxRefreshTokenUserTenant: index("idx_refresh_token_user_tenant").using(
        "btree",
        table.userId.asc().nullsLast(),
        table.tenantId.asc().nullsLast(),
      ),
      ukRefreshToken: uniqueIndex("uk_refresh_token").using(
        "btree",
        table.refreshToken.asc().nullsLast(),
      ),
      oauthRefreshTokenAccessTokenIdOauthAccessTokenIdFk: foreignKey({
        columns: [table.accessTokenId],
        foreignColumns: [oauthAccessToken.id],
        name: "oauth_refresh_token_access_token_id_oauth_access_token_id_fk",
      }).onDelete("cascade"),
      oauthRefreshTokenClientIdOauthClientClientIdFk: foreignKey({
        columns: [table.clientId],
        foreignColumns: [oauthClient.clientId],
        name: "oauth_refresh_token_client_id_oauth_client_client_id_fk",
      }).onDelete("cascade"),
      oauthRefreshTokenUserIdSysUserIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [sysUser.id],
        name: "oauth_refresh_token_user_id_sys_user_id_fk",
      }).onDelete("set null"),
      oauthRefreshTokenTenantIdTenantIdFk: foreignKey({
        columns: [table.tenantId],
        foreignColumns: [tenant.id],
        name: "oauth_refresh_token_tenant_id_tenant_id_fk",
      }).onDelete("set null"),
      oauthRefreshTokenIdNotNull: check("oauth_refresh_token_id_not_null", sql`NOT NULL id`),
      oauthRefreshTokenRefreshTokenNotNull: check(
        "oauth_refresh_token_refresh_token_not_null",
        sql`NOT NULL refresh_token`,
      ),
      oauthRefreshTokenAccessTokenIdNotNull: check(
        "oauth_refresh_token_access_token_id_not_null",
        sql`NOT NULL access_token_id`,
      ),
      oauthRefreshTokenClientIdNotNull: check(
        "oauth_refresh_token_client_id_not_null",
        sql`NOT NULL client_id`,
      ),
      oauthRefreshTokenExpiresAtNotNull: check(
        "oauth_refresh_token_expires_at_not_null",
        sql`NOT NULL expires_at`,
      ),
      oauthRefreshTokenRevokedNotNull: check(
        "oauth_refresh_token_revoked_not_null",
        sql`NOT NULL revoked`,
      ),
      oauthRefreshTokenCreatedAtNotNull: check(
        "oauth_refresh_token_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
    };
  },
);

export const sysMenu = pgTable(
  "sys_menu",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    parentId: uuid("parent_id")
      .default(sql`'00000000-0000-0000-0000-000000000000'`)
      .notNull(),
    title: varchar({ length: 64 }).notNull(),
    type: smallint().notNull(),
    path: varchar({ length: 255 }),
    component: varchar({ length: 255 }),
    perms: varchar({ length: 128 }),
    icon: varchar({ length: 128 }),
    sortOrder: integer("sort_order").default(0).notNull(),
    status: smallint().default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      idxSysMenuClientParent: index("idx_sys_menu_client_parent").using(
        "btree",
        table.clientId.asc().nullsLast(),
        table.parentId.asc().nullsLast(),
      ),
      idxSysMenuClientType: index("idx_sys_menu_client_type").using(
        "btree",
        table.clientId.asc().nullsLast(),
        table.type.asc().nullsLast(),
      ),
      sysMenuClientIdOauthClientClientIdFk: foreignKey({
        columns: [table.clientId],
        foreignColumns: [oauthClient.clientId],
        name: "sys_menu_client_id_oauth_client_client_id_fk",
      }).onDelete("cascade"),
      sysMenuIdNotNull: check("sys_menu_id_not_null", sql`NOT NULL id`),
      sysMenuClientIdNotNull: check("sys_menu_client_id_not_null", sql`NOT NULL client_id`),
      sysMenuParentIdNotNull: check("sys_menu_parent_id_not_null", sql`NOT NULL parent_id`),
      sysMenuTitleNotNull: check("sys_menu_title_not_null", sql`NOT NULL title`),
      sysMenuTypeNotNull: check("sys_menu_type_not_null", sql`NOT NULL type`),
      sysMenuSortOrderNotNull: check("sys_menu_sort_order_not_null", sql`NOT NULL sort_order`),
      sysMenuStatusNotNull: check("sys_menu_status_not_null", sql`NOT NULL status`),
      sysMenuCreatedAtNotNull: check("sys_menu_created_at_not_null", sql`NOT NULL created_at`),
    };
  },
);

export const sysRole = pgTable(
  "sys_role",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    roleCode: varchar("role_code", { length: 64 }).notNull(),
    roleName: varchar("role_name", { length: 64 }).notNull(),
    description: varchar({ length: 255 }),
    isPreset: boolean("is_preset").default(false).notNull(),
    status: smallint().default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      idxSysRoleTenantClient: index("idx_sys_role_tenant_client").using(
        "btree",
        table.tenantId.asc().nullsLast(),
        table.clientId.asc().nullsLast(),
      ),
      ukTenantClientRoleCode: uniqueIndex("uk_tenant_client_role_code").using(
        "btree",
        table.tenantId.asc().nullsLast(),
        table.clientId.asc().nullsLast(),
        table.roleCode.asc().nullsLast(),
      ),
      sysRoleTenantIdTenantIdFk: foreignKey({
        columns: [table.tenantId],
        foreignColumns: [tenant.id],
        name: "sys_role_tenant_id_tenant_id_fk",
      }).onDelete("cascade"),
      sysRoleClientIdOauthClientClientIdFk: foreignKey({
        columns: [table.clientId],
        foreignColumns: [oauthClient.clientId],
        name: "sys_role_client_id_oauth_client_client_id_fk",
      }).onDelete("cascade"),
      sysRoleIdNotNull: check("sys_role_id_not_null", sql`NOT NULL id`),
      sysRoleTenantIdNotNull: check("sys_role_tenant_id_not_null", sql`NOT NULL tenant_id`),
      sysRoleClientIdNotNull: check("sys_role_client_id_not_null", sql`NOT NULL client_id`),
      sysRoleRoleCodeNotNull: check("sys_role_role_code_not_null", sql`NOT NULL role_code`),
      sysRoleRoleNameNotNull: check("sys_role_role_name_not_null", sql`NOT NULL role_name`),
      sysRoleIsPresetNotNull: check("sys_role_is_preset_not_null", sql`NOT NULL is_preset`),
      sysRoleStatusNotNull: check("sys_role_status_not_null", sql`NOT NULL status`),
      sysRoleCreatedAtNotNull: check("sys_role_created_at_not_null", sql`NOT NULL created_at`),
      sysRoleUpdatedAtNotNull: check("sys_role_updated_at_not_null", sql`NOT NULL updated_at`),
    };
  },
);

export const sysRoleMenu = pgTable(
  "sys_role_menu",
  {
    roleId: uuid("role_id").notNull(),
    menuId: uuid("menu_id").notNull(),
  },
  (table) => {
    return {
      idxSysRoleMenuMenuId: index("idx_sys_role_menu_menu_id").using(
        "btree",
        table.menuId.asc().nullsLast(),
      ),
      sysRoleMenuRoleIdSysRoleIdFk: foreignKey({
        columns: [table.roleId],
        foreignColumns: [sysRole.id],
        name: "sys_role_menu_role_id_sys_role_id_fk",
      }).onDelete("cascade"),
      sysRoleMenuMenuIdSysMenuIdFk: foreignKey({
        columns: [table.menuId],
        foreignColumns: [sysMenu.id],
        name: "sys_role_menu_menu_id_sys_menu_id_fk",
      }).onDelete("cascade"),
      sysRoleMenuRoleIdMenuIdPk: primaryKey({
        columns: [table.roleId, table.menuId],
        name: "sys_role_menu_role_id_menu_id_pk",
      }),
      sysRoleMenuRoleIdNotNull: check("sys_role_menu_role_id_not_null", sql`NOT NULL role_id`),
      sysRoleMenuMenuIdNotNull: check("sys_role_menu_menu_id_not_null", sql`NOT NULL menu_id`),
    };
  },
);

export const sysUser = pgTable(
  "sys_user",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    username: varchar({ length: 64 }).notNull(),
    password: varchar({ length: 255 }).notNull(),
    email: varchar({ length: 128 }),
    mobile: varchar({ length: 32 }),
    status: smallint().default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    failedAttempts: integer("failed_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true, mode: "string" }),
  },
  (table) => {
    return {
      ukSysUserEmail: uniqueIndex("uk_sys_user_email").using(
        "btree",
        table.email.asc().nullsLast(),
      ),
      ukSysUserMobile: uniqueIndex("uk_sys_user_mobile").using(
        "btree",
        table.mobile.asc().nullsLast(),
      ),
      ukSysUserUsername: uniqueIndex("uk_sys_user_username").using(
        "btree",
        table.username.asc().nullsLast(),
      ),
      sysUserIdNotNull: check("sys_user_id_not_null", sql`NOT NULL id`),
      sysUserUsernameNotNull: check("sys_user_username_not_null", sql`NOT NULL username`),
      sysUserPasswordNotNull: check("sys_user_password_not_null", sql`NOT NULL password`),
      sysUserStatusNotNull: check("sys_user_status_not_null", sql`NOT NULL status`),
      sysUserCreatedAtNotNull: check("sys_user_created_at_not_null", sql`NOT NULL created_at`),
      sysUserUpdatedAtNotNull: check("sys_user_updated_at_not_null", sql`NOT NULL updated_at`),
      sysUserFailedAttemptsNotNull: check(
        "sys_user_failed_attempts_not_null",
        sql`NOT NULL failed_attempts`,
      ),
    };
  },
);

export const tenant = pgTable(
  "tenant",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    tenantKey: varchar("tenant_key", { length: 64 }).notNull(),
    name: varchar({ length: 128 }).notNull(),
    status: smallint().default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      ukTenantKey: uniqueIndex("uk_tenant_key").using("btree", table.tenantKey.asc().nullsLast()),
      tenantIdNotNull: check("tenant_id_not_null", sql`NOT NULL id`),
      tenantTenantKeyNotNull: check("tenant_tenant_key_not_null", sql`NOT NULL tenant_key`),
      tenantNameNotNull: check("tenant_name_not_null", sql`NOT NULL name`),
      tenantStatusNotNull: check("tenant_status_not_null", sql`NOT NULL status`),
      tenantCreatedAtNotNull: check("tenant_created_at_not_null", sql`NOT NULL created_at`),
      tenantUpdatedAtNotNull: check("tenant_updated_at_not_null", sql`NOT NULL updated_at`),
    };
  },
);

export const tenantApplication = pgTable(
  "tenant_application",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    tenantId: uuid("tenant_id").notNull(),
    clientId: varchar("client_id", { length: 64 }).notNull(),
    status: smallint().default(1).notNull(),
    expireTime: timestamp("expire_time", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      idxTenantApplicationClientId: index("idx_tenant_application_client_id").using(
        "btree",
        table.clientId.asc().nullsLast(),
      ),
      ukTenantClient: uniqueIndex("uk_tenant_client").using(
        "btree",
        table.tenantId.asc().nullsLast(),
        table.clientId.asc().nullsLast(),
      ),
      tenantApplicationTenantIdTenantIdFk: foreignKey({
        columns: [table.tenantId],
        foreignColumns: [tenant.id],
        name: "tenant_application_tenant_id_tenant_id_fk",
      }).onDelete("cascade"),
      tenantApplicationClientIdOauthClientClientIdFk: foreignKey({
        columns: [table.clientId],
        foreignColumns: [oauthClient.clientId],
        name: "tenant_application_client_id_oauth_client_client_id_fk",
      }).onDelete("cascade"),
      tenantApplicationIdNotNull: check("tenant_application_id_not_null", sql`NOT NULL id`),
      tenantApplicationTenantIdNotNull: check(
        "tenant_application_tenant_id_not_null",
        sql`NOT NULL tenant_id`,
      ),
      tenantApplicationClientIdNotNull: check(
        "tenant_application_client_id_not_null",
        sql`NOT NULL client_id`,
      ),
      tenantApplicationStatusNotNull: check(
        "tenant_application_status_not_null",
        sql`NOT NULL status`,
      ),
      tenantApplicationCreatedAtNotNull: check(
        "tenant_application_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
    };
  },
);

export const tenantMember = pgTable(
  "tenant_member",
  {
    id: uuid()
      .default(sql`uuid_generate_v4()`)
      .primaryKey()
      .notNull(),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    memberName: varchar("member_name", { length: 64 }),
    isOwner: boolean("is_owner").default(false).notNull(),
    status: smallint().default(1).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => {
    return {
      idxTenantMemberTenantId: index("idx_tenant_member_tenant_id").using(
        "btree",
        table.tenantId.asc().nullsLast(),
      ),
      idxTenantMemberUserId: index("idx_tenant_member_user_id").using(
        "btree",
        table.userId.asc().nullsLast(),
      ),
      ukTenantUser: uniqueIndex("uk_tenant_user").using(
        "btree",
        table.tenantId.asc().nullsLast(),
        table.userId.asc().nullsLast(),
      ),
      tenantMemberTenantIdTenantIdFk: foreignKey({
        columns: [table.tenantId],
        foreignColumns: [tenant.id],
        name: "tenant_member_tenant_id_tenant_id_fk",
      }).onDelete("cascade"),
      tenantMemberUserIdSysUserIdFk: foreignKey({
        columns: [table.userId],
        foreignColumns: [sysUser.id],
        name: "tenant_member_user_id_sys_user_id_fk",
      }).onDelete("cascade"),
      tenantMemberIdNotNull: check("tenant_member_id_not_null", sql`NOT NULL id`),
      tenantMemberTenantIdNotNull: check(
        "tenant_member_tenant_id_not_null",
        sql`NOT NULL tenant_id`,
      ),
      tenantMemberUserIdNotNull: check("tenant_member_user_id_not_null", sql`NOT NULL user_id`),
      tenantMemberIsOwnerNotNull: check("tenant_member_is_owner_not_null", sql`NOT NULL is_owner`),
      tenantMemberStatusNotNull: check("tenant_member_status_not_null", sql`NOT NULL status`),
      tenantMemberCreatedAtNotNull: check(
        "tenant_member_created_at_not_null",
        sql`NOT NULL created_at`,
      ),
      tenantMemberUpdatedAtNotNull: check(
        "tenant_member_updated_at_not_null",
        sql`NOT NULL updated_at`,
      ),
    };
  },
);

export const tenantMemberRole = pgTable(
  "tenant_member_role",
  {
    memberId: uuid("member_id").notNull(),
    roleId: uuid("role_id").notNull(),
  },
  (table) => {
    return {
      idxTenantMemberRoleRoleId: index("idx_tenant_member_role_role_id").using(
        "btree",
        table.roleId.asc().nullsLast(),
      ),
      tenantMemberRoleMemberIdTenantMemberIdFk: foreignKey({
        columns: [table.memberId],
        foreignColumns: [tenantMember.id],
        name: "tenant_member_role_member_id_tenant_member_id_fk",
      }).onDelete("cascade"),
      tenantMemberRoleRoleIdSysRoleIdFk: foreignKey({
        columns: [table.roleId],
        foreignColumns: [sysRole.id],
        name: "tenant_member_role_role_id_sys_role_id_fk",
      }).onDelete("cascade"),
      tenantMemberRoleMemberIdRoleIdPk: primaryKey({
        columns: [table.roleId, table.memberId],
        name: "tenant_member_role_member_id_role_id_pk",
      }),
      tenantMemberRoleMemberIdNotNull: check(
        "tenant_member_role_member_id_not_null",
        sql`NOT NULL member_id`,
      ),
      tenantMemberRoleRoleIdNotNull: check(
        "tenant_member_role_role_id_not_null",
        sql`NOT NULL role_id`,
      ),
    };
  },
);
