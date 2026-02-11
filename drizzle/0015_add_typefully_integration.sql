CREATE TABLE `typefully_connections` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `encrypted_api_key` text NOT NULL,
  `api_key_label` text,
  `typefully_user_id` integer,
  `typefully_user_name` text,
  `typefully_user_email` text,
  `last_validated_at` integer,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `typefully_connections_user_unique` ON `typefully_connections` (`user_id`);
CREATE INDEX `typefully_connections_user_idx` ON `typefully_connections` (`user_id`);

CREATE TABLE `typefully_social_sets` (
  `id` text PRIMARY KEY NOT NULL,
  `connection_id` text NOT NULL,
  `social_set_id` integer NOT NULL,
  `username` text NOT NULL,
  `name` text NOT NULL,
  `profile_image_url` text NOT NULL,
  `team_id` text,
  `team_name` text,
  `linked_account_id` text,
  `last_synced_at` integer NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`connection_id`) REFERENCES `typefully_connections`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`linked_account_id`) REFERENCES `accounts`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `typefully_social_sets_connection_idx` ON `typefully_social_sets` (`connection_id`);
CREATE INDEX `typefully_social_sets_social_set_idx` ON `typefully_social_sets` (`social_set_id`);
CREATE INDEX `typefully_social_sets_linked_account_idx` ON `typefully_social_sets` (`linked_account_id`);
CREATE UNIQUE INDEX `typefully_social_sets_connection_social_set_unique`
  ON `typefully_social_sets` (`connection_id`, `social_set_id`);
