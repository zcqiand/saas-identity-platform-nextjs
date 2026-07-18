CREATE TABLE `health_check` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`ok` integer NOT NULL,
	`checked_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
