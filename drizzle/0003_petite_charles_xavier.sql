ALTER TABLE `cast_media` ADD `cloudflare_id` text;--> statement-breakpoint
ALTER TABLE `cast_media` ADD `video_status` text;--> statement-breakpoint
ALTER TABLE `cast_media` ADD `mp4_url` text;--> statement-breakpoint
ALTER TABLE `cast_media` ADD `hls_url` text;--> statement-breakpoint
ALTER TABLE `cast_media` ADD `thumbnail_url` text;--> statement-breakpoint
CREATE INDEX `media_cloudflare_idx` ON `cast_media` (`cloudflare_id`);