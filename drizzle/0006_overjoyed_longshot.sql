CREATE TABLE `user_style_profiles` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`fid` integer NOT NULL,
	`tone` text DEFAULT 'casual' NOT NULL,
	`avg_length` integer DEFAULT 150 NOT NULL,
	`common_phrases` text,
	`topics` text,
	`emoji_usage` text DEFAULT 'light' NOT NULL,
	`language_preference` text DEFAULT 'en' NOT NULL,
	`sample_casts` text,
	`analyzed_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_style_profiles_user_id_unique` ON `user_style_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `style_profiles_user_idx` ON `user_style_profiles` (`user_id`);--> statement-breakpoint
CREATE INDEX `style_profiles_fid_idx` ON `user_style_profiles` (`fid`);