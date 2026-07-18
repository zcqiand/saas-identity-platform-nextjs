PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`key` text NOT NULL,
	`app_id` integer NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`expires_at` text DEFAULT 'never' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_api_keys`("id", "name", "key", "app_id", "enabled", "expires_at", "created_at") SELECT "id", "name", "key", "app_id", "enabled", "expires_at", "created_at" FROM `api_keys`;--> statement-breakpoint
DROP TABLE `api_keys`;--> statement-breakpoint
ALTER TABLE `__new_api_keys` RENAME TO `api_keys`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_unique` ON `api_keys` (`key`);--> statement-breakpoint
CREATE TABLE `__new_app_menus` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`app_id` integer NOT NULL,
	`parent_id` integer,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`app_id`) REFERENCES `apps`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `app_menus`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_app_menus`("id", "app_id", "parent_id", "code", "name", "path", "sort", "enabled", "created_at", "updated_at") SELECT "id", "app_id", "parent_id", "code", "name", "path", "sort", "enabled", "created_at", "updated_at" FROM `app_menus`;--> statement-breakpoint
DROP TABLE `app_menus`;--> statement-breakpoint
ALTER TABLE `__new_app_menus` RENAME TO `app_menus`;--> statement-breakpoint
CREATE TABLE `__new_apps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'web' NOT NULL,
	`description` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_apps`("id", "code", "name", "type", "description", "enabled", "created_at", "updated_at") SELECT "id", "code", "name", "type", "description", "enabled", "created_at", "updated_at" FROM `apps`;--> statement-breakpoint
DROP TABLE `apps`;--> statement-breakpoint
ALTER TABLE `__new_apps` RENAME TO `apps`;--> statement-breakpoint
CREATE UNIQUE INDEX `apps_code_unique` ON `apps` (`code`);--> statement-breakpoint
CREATE TABLE `__new_audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`operator` text NOT NULL,
	`resource` text NOT NULL,
	`resource_id` text NOT NULL,
	`ip` text DEFAULT '127.0.0.1' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`timestamp` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_audit_logs`("id", "action", "operator", "resource", "resource_id", "ip", "detail", "timestamp") SELECT "id", "action", "operator", "resource", "resource_id", "ip", "detail", "timestamp" FROM `audit_logs`;--> statement-breakpoint
DROP TABLE `audit_logs`;--> statement-breakpoint
ALTER TABLE `__new_audit_logs` RENAME TO `audit_logs`;--> statement-breakpoint
CREATE TABLE `__new_health_check` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ok` integer NOT NULL,
	`checked_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_health_check`("id", "ok", "checked_at") SELECT "id", "ok", "checked_at" FROM `health_check`;--> statement-breakpoint
DROP TABLE `health_check`;--> statement-breakpoint
ALTER TABLE `__new_health_check` RENAME TO `health_check`;--> statement-breakpoint
CREATE TABLE `__new_orgs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`parent_id`) REFERENCES `orgs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_orgs`("id", "name", "parent_id", "sort", "enabled", "created_at", "updated_at") SELECT "id", "name", "parent_id", "sort", "enabled", "created_at", "updated_at" FROM `orgs`;--> statement-breakpoint
DROP TABLE `orgs`;--> statement-breakpoint
ALTER TABLE `__new_orgs` RENAME TO `orgs`;--> statement-breakpoint
CREATE TABLE `__new_platform_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`key` text NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_platform_settings`("id", "key", "value", "description", "updated_at") SELECT "id", "key", "value", "description", "updated_at" FROM `platform_settings`;--> statement-breakpoint
DROP TABLE `platform_settings`;--> statement-breakpoint
ALTER TABLE `__new_platform_settings` RENAME TO `platform_settings`;--> statement-breakpoint
CREATE UNIQUE INDEX `platform_settings_key_unique` ON `platform_settings` (`key`);--> statement-breakpoint
CREATE TABLE `__new_position_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`position_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`joined_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`position_id`) REFERENCES `positions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_position_members`("id", "position_id", "user_id", "joined_at") SELECT "id", "position_id", "user_id", "joined_at" FROM `position_members`;--> statement-breakpoint
DROP TABLE `position_members`;--> statement-breakpoint
ALTER TABLE `__new_position_members` RENAME TO `position_members`;--> statement-breakpoint
CREATE TABLE `__new_positions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`sort` integer DEFAULT 0 NOT NULL,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_positions`("id", "code", "name", "description", "sort", "enabled", "created_at", "updated_at") SELECT "id", "code", "name", "description", "sort", "enabled", "created_at", "updated_at" FROM `positions`;--> statement-breakpoint
DROP TABLE `positions`;--> statement-breakpoint
ALTER TABLE `__new_positions` RENAME TO `positions`;--> statement-breakpoint
CREATE UNIQUE INDEX `positions_code_unique` ON `positions` (`code`);--> statement-breakpoint
CREATE TABLE `__new_role_permissions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`role_id` integer NOT NULL,
	`permission_code` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_role_permissions`("id", "role_id", "permission_code", "created_at") SELECT "id", "role_id", "permission_code", "created_at" FROM `role_permissions`;--> statement-breakpoint
DROP TABLE `role_permissions`;--> statement-breakpoint
ALTER TABLE `__new_role_permissions` RENAME TO `role_permissions`;--> statement-breakpoint
CREATE TABLE `__new_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_roles`("id", "code", "name", "description", "enabled", "created_at", "updated_at") SELECT "id", "code", "name", "description", "enabled", "created_at", "updated_at" FROM `roles`;--> statement-breakpoint
DROP TABLE `roles`;--> statement-breakpoint
ALTER TABLE `__new_roles` RENAME TO `roles`;--> statement-breakpoint
CREATE UNIQUE INDEX `roles_code_unique` ON `roles` (`code`);--> statement-breakpoint
CREATE TABLE `__new_tenant_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tenant_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`joined_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tenant_users`("id", "tenant_id", "user_id", "role", "joined_at") SELECT "id", "tenant_id", "user_id", "role", "joined_at" FROM `tenant_users`;--> statement-breakpoint
DROP TABLE `tenant_users`;--> statement-breakpoint
ALTER TABLE `__new_tenant_users` RENAME TO `tenant_users`;--> statement-breakpoint
CREATE TABLE `__new_tenants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`theme` text DEFAULT 'default' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_tenants`("id", "code", "name", "theme", "created_at") SELECT "id", "code", "name", "theme", "created_at" FROM `tenants`;--> statement-breakpoint
DROP TABLE `tenants`;--> statement-breakpoint
ALTER TABLE `__new_tenants` RENAME TO `tenants`;--> statement-breakpoint
CREATE UNIQUE INDEX `tenants_code_unique` ON `tenants` (`code`);--> statement-breakpoint
CREATE TABLE `__new_user_group_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`joined_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `user_groups`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_group_members`("id", "group_id", "user_id", "joined_at") SELECT "id", "group_id", "user_id", "joined_at" FROM `user_group_members`;--> statement-breakpoint
DROP TABLE `user_group_members`;--> statement-breakpoint
ALTER TABLE `__new_user_group_members` RENAME TO `user_group_members`;--> statement-breakpoint
CREATE TABLE `__new_user_groups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`enabled` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user_groups`("id", "name", "description", "enabled", "created_at", "updated_at") SELECT "id", "name", "description", "enabled", "created_at", "updated_at" FROM `user_groups`;--> statement-breakpoint
DROP TABLE `user_groups`;--> statement-breakpoint
ALTER TABLE `__new_user_groups` RENAME TO `user_groups`;--> statement-breakpoint
CREATE TABLE `__new_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text NOT NULL,
	`roles` text DEFAULT '["member"]' NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_users`("id", "username", "display_name", "email", "roles", "status", "created_at", "updated_at") SELECT "id", "username", "display_name", "email", "roles", "status", "created_at", "updated_at" FROM `users`;--> statement-breakpoint
DROP TABLE `users`;--> statement-breakpoint
ALTER TABLE `__new_users` RENAME TO `users`;--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);