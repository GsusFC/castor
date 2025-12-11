CREATE TABLE `user_channels` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`channel_id` text NOT NULL,
	`channel_name` text NOT NULL,
	`channel_image_url` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`use_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_channels_user_idx` ON `user_channels` (`user_id`);--> statement-breakpoint
CREATE INDEX `user_channels_channel_idx` ON `user_channels` (`channel_id`);--> statement-breakpoint
CREATE INDEX `user_channels_unique` ON `user_channels` (`user_id`,`channel_id`);