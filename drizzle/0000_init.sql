CREATE TABLE "api_keys" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"key_prefix" text NOT NULL,
	"app_id" text NOT NULL,
	"scopes" text[] DEFAULT '{"read"}' NOT NULL,
	"last_used_at" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"expires_at" text DEFAULT 'never' NOT NULL,
	"created_at" text DEFAULT 'now()' NOT NULL,
	CONSTRAINT "api_keys_key_unique" UNIQUE("key")
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
	"created_at" text DEFAULT 'now()' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
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
	"created_at" text DEFAULT 'now()' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL,
	CONSTRAINT "apps_code_unique" UNIQUE("code")
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
	"timestamp" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT 'now()' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "health_check" (
	"id" text PRIMARY KEY NOT NULL,
	"ok" integer NOT NULL,
	"checked_at" text DEFAULT 'now()' NOT NULL
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
CREATE TABLE "login_security" (
	"id" text PRIMARY KEY NOT NULL,
	"ip_whitelist" text[] DEFAULT '{}' NOT NULL,
	"ip_blacklist" text[] DEFAULT '{}' NOT NULL,
	"region_restriction_enabled" boolean DEFAULT false NOT NULL,
	"allowed_regions" text[] DEFAULT '{}' NOT NULL,
	"failed_attempt_lock_enabled" boolean DEFAULT false NOT NULL,
	"lock_threshold" integer DEFAULT 5 NOT NULL,
	"lock_duration" integer DEFAULT 30 NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_config" (
	"id" text PRIMARY KEY NOT NULL,
	"email_enabled" boolean DEFAULT true NOT NULL,
	"sms_enabled" boolean DEFAULT false NOT NULL,
	"in_app_enabled" boolean DEFAULT true NOT NULL,
	"notify_on" text[] DEFAULT '{}' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
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
CREATE TABLE "open_platform_config" (
	"id" text PRIMARY KEY NOT NULL,
	"api_enabled" boolean DEFAULT true NOT NULL,
	"webhook_enabled" boolean DEFAULT true NOT NULL,
	"sdk_enabled" boolean DEFAULT true NOT NULL,
	"open_scopes" text[] DEFAULT '{}' NOT NULL,
	"callback_whitelist" text[] DEFAULT '{}' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
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
	"updated_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "permission_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"permissions" text[] DEFAULT '{}' NOT NULL,
	"menu_ids" text[] DEFAULT '{}' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT 'now()' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" text DEFAULT 'now()' NOT NULL,
	CONSTRAINT "platform_settings_key_unique" UNIQUE("key")
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
	"created_at" text DEFAULT 'now()' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "risk_control" (
	"id" text PRIMARY KEY NOT NULL,
	"anomaly_detection_enabled" boolean DEFAULT true NOT NULL,
	"cross_region_alert_enabled" boolean DEFAULT true NOT NULL,
	"device_fingerprint_enabled" boolean DEFAULT false NOT NULL,
	"risk_score_threshold" integer DEFAULT 70 NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_menu_permissions" (
	"role_id" text NOT NULL,
	"menu_id" text NOT NULL,
	"actions" text[] DEFAULT '{"view"}' NOT NULL,
	"created_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "role_permissions" (
	"role_id" text NOT NULL,
	"permission_code" text NOT NULL,
	"created_at" text DEFAULT 'now()' NOT NULL
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
	"created_at" text DEFAULT 'now()' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
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
CREATE TABLE "sso_states" (
	"state" text PRIMARY KEY NOT NULL,
	"code" text,
	"tenant_id" text,
	"user_id" text,
	"expires_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"theme" text DEFAULT 'default' NOT NULL,
	"config" jsonb,
	"created_at" text DEFAULT 'now()' NOT NULL,
	"updated_at" text,
	CONSTRAINT "tenants_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "token_config" (
	"id" text PRIMARY KEY NOT NULL,
	"access_token_ttl" integer NOT NULL,
	"refresh_token_ttl" integer NOT NULL,
	"refresh_token_enabled" boolean DEFAULT true NOT NULL,
	"token_revocation_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_group_members" (
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" text DEFAULT 'now()' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"email" text NOT NULL,
	"tenant_id" text NOT NULL,
	"department_id" text,
	"position_id" text,
	"roles" text[] DEFAULT '{"member"}' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" text DEFAULT 'now()' NOT NULL,
	"updated_at" text DEFAULT 'now()' NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_menus" ADD CONSTRAINT "app_menus_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "app_menus" ADD CONSTRAINT "app_menus_parent_id_app_menus_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."app_menus"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "departments" ADD CONSTRAINT "departments_parent_id_departments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_scopes" ADD CONSTRAINT "oauth_scopes_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "permission_groups" ADD CONSTRAINT "permission_groups_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_menu_permissions" ADD CONSTRAINT "role_menu_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_menu_permissions" ADD CONSTRAINT "role_menu_permissions_menu_id_app_menus_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."app_menus"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_states" ADD CONSTRAINT "sso_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sso_states" ADD CONSTRAINT "sso_states_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_group_id_user_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."user_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_group_members" ADD CONSTRAINT "user_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_groups" ADD CONSTRAINT "user_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_position_id_positions_id_fk" FOREIGN KEY ("position_id") REFERENCES "public"."positions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "api_keys_key_uq" ON "api_keys" USING btree ("key");--> statement-breakpoint
CREATE INDEX "api_keys_app_idx" ON "api_keys" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "app_menus_app_idx" ON "app_menus" USING btree ("app_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "apps_code_uq" ON "apps" USING btree ("code");--> statement-breakpoint
CREATE INDEX "audit_logs_tenant_idx" ON "audit_logs" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "departments_tenant_idx" ON "departments" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "permission_groups_app_idx" ON "permission_groups" USING btree ("app_id","sort");--> statement-breakpoint
CREATE UNIQUE INDEX "platform_settings_key_uq" ON "platform_settings" USING btree ("key");--> statement-breakpoint
CREATE UNIQUE INDEX "positions_tenant_code_uq" ON "positions" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "role_menu_permissions_pk" ON "role_menu_permissions" USING btree ("role_id","menu_id");--> statement-breakpoint
CREATE UNIQUE INDEX "role_permissions_pk" ON "role_permissions" USING btree ("role_id","permission_code");--> statement-breakpoint
CREATE UNIQUE INDEX "roles_tenant_code_uq" ON "roles" USING btree ("tenant_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_code_uq" ON "tenants" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "user_group_members_pk" ON "user_group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "user_groups_tenant_idx" ON "user_groups" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_uq" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_uq" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_tenant_idx" ON "users" USING btree ("tenant_id");