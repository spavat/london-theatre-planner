CREATE TABLE `scrape_show_results` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`show_id` integer,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`result` text NOT NULL,
	`source` text,
	`fallback_reason` text,
	`performances` integer DEFAULT 0 NOT NULL,
	`performances_added` integer DEFAULT 0 NOT NULL,
	`performances_removed` integer DEFAULT 0 NOT NULL,
	`image_status` text DEFAULT 'none' NOT NULL,
	`error` text,
	`duration_ms` integer NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `scrape_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`show_id`) REFERENCES `shows`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `scrape_show_results_run` ON `scrape_show_results` (`run_id`);--> statement-breakpoint
ALTER TABLE `scrape_runs` ADD `trigger` text DEFAULT 'cli' NOT NULL;--> statement-breakpoint
ALTER TABLE `scrape_runs` ADD `scope` text;--> statement-breakpoint
ALTER TABLE `scrape_runs` ADD `list_source` text;--> statement-breakpoint
ALTER TABLE `scrape_runs` ADD `shows_listed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scrape_runs` ADD `shows_fallback` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scrape_runs` ADD `performances_added` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scrape_runs` ADD `performances_removed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scrape_runs` ADD `images_stored` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scrape_runs` ADD `images_failed` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `scrape_runs` ADD `warnings` text;