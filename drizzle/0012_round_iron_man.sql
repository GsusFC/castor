CREATE TABLE `ai_generated_casts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`cast_hash` text NOT NULL,
	`status` text DEFAULT 'pending_analysis' NOT NULL,
	`created_at` integer NOT NULL,
	`analyzed_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_generated_casts_cast_hash_unique` ON `ai_generated_casts` (`cast_hash`);--> statement-breakpoint
CREATE INDEX `ai_casts_user_idx` ON `ai_generated_casts` (`user_id`);--> statement-breakpoint
CREATE INDEX `ai_casts_status_idx` ON `ai_generated_casts` (`status`);--> statement-breakpoint
ALTER TABLE `user_style_profiles` ADD `engagement_insights` text;