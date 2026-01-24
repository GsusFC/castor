-- Add notifications table for SSE polling fallback
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient_fid` integer NOT NULL,
	`type` text NOT NULL,
	`cast_hash` text,
	`actor_fid` integer,
	`actor_username` text,
	`actor_display_name` text,
	`actor_pfp_url` text,
	`content` text,
	`read` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL
);

CREATE INDEX `notifications_recipient_idx` ON `notifications` (`recipient_fid`);
CREATE INDEX `notifications_created_idx` ON `notifications` (`created_at`);
CREATE INDEX `notifications_read_idx` ON `notifications` (`read`);
