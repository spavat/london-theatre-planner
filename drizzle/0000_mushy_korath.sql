CREATE TABLE `performances` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`show_id` integer NOT NULL,
	`starts_at` text NOT NULL,
	`local_date` text NOT NULL,
	`local_time` text NOT NULL,
	`slot` text NOT NULL,
	`min_price` real,
	`booking_url` text,
	`source` text NOT NULL,
	`scraped_at` text NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `performances_show_starts` ON `performances` (`show_id`,`starts_at`);--> statement-breakpoint
CREATE INDEX `performances_local_date` ON `performances` (`local_date`);--> statement-breakpoint
CREATE TABLE `scrape_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`shows_ok` integer DEFAULT 0 NOT NULL,
	`shows_failed` integer DEFAULT 0 NOT NULL,
	`error_log` text
);
--> statement-breakpoint
CREATE TABLE `show_sources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`show_id` integer NOT NULL,
	`source` text NOT NULL,
	`external_id` text NOT NULL,
	`url` text NOT NULL,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `show_sources_source_external` ON `show_sources` (`source`,`external_id`);--> statement-breakpoint
CREATE TABLE `shows` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`venue` text,
	`running_time` text,
	`image_key` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	`updated_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `shows_slug_unique` ON `shows` (`slug`);