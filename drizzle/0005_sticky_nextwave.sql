CREATE TABLE `cast_analytics` (
	`id` text PRIMARY KEY NOT NULL,
	`cast_hash` text NOT NULL,
	`account_id` text NOT NULL,
	`content` text,
	`likes` integer DEFAULT 0 NOT NULL,
	`recasts` integer DEFAULT 0 NOT NULL,
	`replies` integer DEFAULT 0 NOT NULL,
	`published_at` integer NOT NULL,
	`last_updated_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `analytics_cast_hash_idx` ON `cast_analytics` (`cast_hash`);--> statement-breakpoint
CREATE INDEX `analytics_account_idx` ON `cast_analytics` (`account_id`);--> statement-breakpoint
CREATE INDEX `analytics_published_idx` ON `cast_analytics` (`published_at`);