CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`action` text NOT NULL,
	`operator` text NOT NULL,
	`resource` text NOT NULL,
	`resource_id` text NOT NULL,
	`ip` text DEFAULT '127.0.0.1' NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`timestamp` text DEFAULT '(datetime(''now''))' NOT NULL
);
