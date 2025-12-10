CREATE TABLE `account_documents` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text NOT NULL,
	`type` text DEFAULT 'text' NOT NULL,
	`content` text NOT NULL,
	`source_url` text,
	`added_by_id` text,
	`added_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`added_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `docs_account_idx` ON `account_documents` (`account_id`);--> statement-breakpoint
CREATE TABLE `account_knowledge_base` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`brand_voice` text,
	`bio` text,
	`expertise` text,
	`always_do` text,
	`never_do` text,
	`hashtags` text,
	`default_tone` text DEFAULT 'casual',
	`default_language` text DEFAULT 'en',
	`internal_notes` text,
	`updated_at` integer NOT NULL,
	`updated_by_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`updated_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `account_knowledge_base_account_id_unique` ON `account_knowledge_base` (`account_id`);--> statement-breakpoint
CREATE INDEX `kb_account_idx` ON `account_knowledge_base` (`account_id`);--> statement-breakpoint
CREATE TABLE `account_members` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`can_edit_context` integer DEFAULT false NOT NULL,
	`invited_by_id` text,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`invited_by_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `account_members_account_user_idx` ON `account_members` (`account_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `account_members_user_idx` ON `account_members` (`user_id`);