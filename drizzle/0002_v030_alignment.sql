-- 0002_v030_alignment.sql
-- shared v0.3.0 字段合同对齐 + 11 张新表 + role_menu_permissions 中间表
--
-- dev DB 由 stage 开头 DROP；CI 用 ephemeral PG。本 migration 假设空库，直接 CREATE。
-- 若需从旧 schema 升级：先 DROP 所有表再 CREATE（注意会丢失数据，dev DB 允许）。
--
-- 变化：
--   - 全部 PK 从 serial 改 text
--   - 5 张部门类表（users/departments/positions/roles/user_groups）加 tenantId required
--   - 3 张应用类表（apps/permission_groups/api_keys）加 appId required
--   - orgs → departments 重命名
--   - 删除 position_members 表
--   - 新增 icon/permission on app_menus, keyPrefix/scopes/lastUsedAt on api_keys,
--     menuIds on permission_groups, theme/sort on apps
--   - users.roles 从 text JSON 字符串改 text[] 原生数组
--   - 新增 role_menu_permissions 中间表
--   - 新增 11 张表：oauth_scopes / login_methods / sso_providers / oauth2_providers /
--     token_config / login_security / password_policy / risk_control /
--     notification_config / open_platform_config / menu_templates

-- 旧表清理（dev/CI 允许）
DROP TABLE IF EXISTS "position_members" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "user_group_members" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "permission_groups" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "role_permissions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "audit_logs" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "api_keys" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "app_menus" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "apps" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "user_groups" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "roles" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "positions" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "orgs" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "users" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "tenant_users" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "sso_states" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "tenants" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "platform_settings" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "health_check" CASCADE;
--> statement-breakpoint

-- 新表（顺序：父级先建，FK 后建）
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"theme" text DEFAULT 'default' NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "tenants_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"tenant_id" text NOT NULL,
	"department_id" text,
	"roles" text[] DEFAULT ARRAY['member']::text[] NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "tenant_users" (
	"tenant_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_states" (
	"state" text PRIMARY KEY NOT NULL,
	"code" text,
	"tenant_id" text,
	"user_id" text,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "roles" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" text NOT NULL,
	"permission_code" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_menu_permissions" (
	"role_id" text NOT NULL,
	"menu_id" text NOT NULL,
	"actions" text[] DEFAULT ARRAY['view']::text[] NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_group_members" (
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"menu_ids" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'web' NOT NULL,
	"description" text,
	"theme" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "apps_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "app_menus" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"parent_id" text,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"path" text NOT NULL,
	"icon" text,
	"permission" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"key_prefix" text NOT NULL,
	"app_id" text NOT NULL,
	"scopes" text[] DEFAULT ARRAY['read']::text[] NOT NULL,
	"last_used_at" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"expires_at" text DEFAULT 'never' NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "menu_templates" (
	"app_id" text PRIMARY KEY NOT NULL,
	"menus" text NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text,
	"action" text NOT NULL,
	"operator" text NOT NULL,
	"resource" text NOT NULL,
	"resource_id" text NOT NULL,
	"ip" text DEFAULT '127.0.0.1' NOT NULL,
	"detail" text DEFAULT '' NOT NULL,
	"timestamp" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "health_check" (
	"id" text PRIMARY KEY NOT NULL,
	"ok" integer NOT NULL,
	"checked_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint

-- 6 张单例配置（M06.F09）
CREATE TABLE "token_config" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token_ttl" integer NOT NULL,
	"refresh_token_ttl" integer NOT NULL,
	"refresh_token_enabled" boolean DEFAULT true NOT NULL,
	"token_revocation_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_security" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_whitelist" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"ip_blacklist" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"region_restriction_enabled" boolean DEFAULT false NOT NULL,
	"allowed_regions" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"failed_attempt_lock_enabled" boolean DEFAULT false NOT NULL,
	"lock_threshold" integer DEFAULT 5 NOT NULL,
	"lock_duration" integer DEFAULT 30 NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_policy" (
	"id" text PRIMARY KEY NOT NULL,
	"min_length" integer DEFAULT 8 NOT NULL,
	"require_uppercase" boolean DEFAULT true NOT NULL,
	"require_lowercase" boolean DEFAULT true NOT NULL,
	"require_digit" boolean DEFAULT true NOT NULL,
	"require_special" boolean DEFAULT false NOT NULL,
	"expire_days" integer DEFAULT 90 NOT NULL,
	"history_count" integer DEFAULT 5 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_control" (
	"id" text PRIMARY KEY NOT NULL,
	"anomaly_detection_enabled" boolean DEFAULT true NOT NULL,
	"cross_region_alert_enabled" boolean DEFAULT true NOT NULL,
	"device_fingerprint_enabled" boolean DEFAULT false NOT NULL,
	"risk_score_threshold" integer DEFAULT 70 NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_config" (
	"id" text PRIMARY KEY NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"notify_on" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "open_platform_config" (
	"id" text PRIMARY KEY NOT NULL,
	"api_enabled" boolean DEFAULT true NOT NULL,
	"webhook_enabled" boolean DEFAULT true NOT NULL,
	"sdk_enabled" boolean DEFAULT true NOT NULL,
	"open_scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"callback_whitelist" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"updated_at" text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS') NOT NULL
);
--> statement-breakpoint

-- 注册表类（M06.F10/F11/F12/F13）
CREATE TABLE "oauth_scopes" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"risk_level" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_methods" (
	"id" text PRIMARY KEY NOT NULL,
	"method" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean NOT NULL,
	"sort" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sso_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"type" text NOT NULL,
	"client_id" text,
	"issuer_url" text,
	"enabled" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE "oauth2_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"provider" text NOT NULL,
	"client_id" text,
	"enabled" boolean NOT NULL
);
--> statement-breakpoint

-- 索引
CREATE UNIQUE INDEX "tenant_users_pk" ON "tenant_users" ("tenant_id","user_id");
--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "departments_tenant_idx" ON "departments" ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "positions_tenant_code_uq" ON "positions" ("tenant_id","code");
--> statement-breakpoint
CREATE UNIQUE INDEX "roles_tenant_code_uq" ON "roles" ("tenant_id","code");
--> statement-breakpoint
CREATE INDEX "user_groups_tenant_idx" ON "user_groups" ("tenant_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_group_members_pk" ON "user_group_members" ("group_id","user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_pk" ON "role_permissions" ("role_id","permission_code");
--> statement-breakpoint
CREATE UNIQUE INDEX "role_menu_permissions_pk" ON "role_menu_permissions" ("role_id","menu_id");
--> statement-breakpoint
CREATE INDEX "permission_groups_app_idx" ON "permission_groups" ("app_id","sort");
--> statement-breakpoint
CREATE INDEX "app_menus_app_idx" ON "app_menus" ("app_id","sort");
--> statement-breakpoint
CREATE INDEX "api_keys_app_idx" ON "api_keys" ("app_id");
--> statement-breakpoint
CREATE INDEX "oauth_scopes_app_idx" ON "oauth_scopes" ("app_id");
--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_idx" ON "audit_logs" ("tenant_id");
--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" ("timestamp");
--> statement-breakpoint

-- FK 约束（最后建，避免循环依赖）
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "departments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sso_states" ADD CONSTRAINT "sso_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "sso_states" ADD CONSTRAINT "sso_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "role_menu_permissions" ADD CONSTRAINT "role_menu_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "role_menu_permissions" ADD CONSTRAINT "role_menu_permissions_menu_id_app_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "app_menus"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_id_user_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "user_groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "permission_groups" ADD CONSTRAINT "permission_groups_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_menus" ADD CONSTRAINT "app_menus_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "app_menus" ADD CONSTRAINT "app_menus_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "app_menus"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "menu_templates" ADD CONSTRAINT "menu_templates_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "oauth_scopes" ADD CONSTRAINT "oauth_scopes_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "apps"("id") ON DELETE cascade ON UPDATE no action;