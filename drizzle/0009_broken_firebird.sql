CREATE TABLE `analytics_insights_cache` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`insights` text NOT NULL,
	`stats` text NOT NULL,
	`generated_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `analytics_insights_cache_account_idx` ON `analytics_insights_cache` (`account_id`);--> statement-breakpoint
ALTER TABLE `accounts` DROP COLUMN `is_shared`;