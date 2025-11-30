CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`fid` integer NOT NULL,
	`username` text NOT NULL,
	`display_name` text,
	`pfp_url` text,
	`signer_uuid` text NOT NULL,
	`signer_status` text DEFAULT 'pending' NOT NULL,
	`type` text DEFAULT 'personal' NOT NULL,
	`is_premium` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_fid_unique` ON `accounts` (`fid`);--> statement-breakpoint
CREATE INDEX `accounts_fid_idx` ON `accounts` (`fid`);--> statement-breakpoint
CREATE INDEX `accounts_signer_idx` ON `accounts` (`signer_uuid`);--> statement-breakpoint
CREATE TABLE `cast_media` (
	`id` text PRIMARY KEY NOT NULL,
	`cast_id` text NOT NULL,
	`url` text NOT NULL,
	`type` text DEFAULT 'image' NOT NULL,
	`order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`cast_id`) REFERENCES `scheduled_casts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `media_cast_idx` ON `cast_media` (`cast_id`);--> statement-breakpoint
CREATE TABLE `scheduled_casts` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`content` text NOT NULL,
	`scheduled_at` integer NOT NULL,
	`published_at` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`cast_hash` text,
	`parent_hash` text,
	`channel_id` text,
	`error_message` text,
	`retry_count` integer DEFAULT 0 NOT NULL,
	`thread_id` text,
	`thread_order` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `casts_account_idx` ON `scheduled_casts` (`account_id`);--> statement-breakpoint
CREATE INDEX `casts_status_idx` ON `scheduled_casts` (`status`);--> statement-breakpoint
CREATE INDEX `casts_scheduled_idx` ON `scheduled_casts` (`scheduled_at`);--> statement-breakpoint
CREATE INDEX `casts_thread_idx` ON `scheduled_casts` (`thread_id`);--> statement-breakpoint
CREATE TABLE `threads` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`title` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`scheduled_at` integer,
	`published_at` integer,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `threads_account_idx` ON `threads` (`account_id`);--> statement-breakpoint
CREATE INDEX `threads_status_idx` ON `threads` (`status`);