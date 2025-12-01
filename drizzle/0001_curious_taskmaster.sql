CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`fid` integer NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`pfp_url` text,
	`role` text DEFAULT 'admin' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_fid_unique` ON `users` (`fid`);--> statement-breakpoint
CREATE INDEX `users_fid_idx` ON `users` (`fid`);--> statement-breakpoint
ALTER TABLE `accounts` ADD `owner_id` text REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `accounts` ADD `is_shared` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `accounts_owner_idx` ON `accounts` (`owner_id`);--> statement-breakpoint
ALTER TABLE `scheduled_casts` ADD `created_by_id` text REFERENCES users(id);--> statement-breakpoint
CREATE INDEX `casts_created_by_idx` ON `scheduled_casts` (`created_by_id`);