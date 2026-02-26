CREATE TABLE `cron_runs` (
  `id` text PRIMARY KEY NOT NULL,
  `job_name` text NOT NULL,
  `started_at` integer NOT NULL,
  `finished_at` integer,
  `success` integer NOT NULL DEFAULT 0,
  `published` integer,
  `failed` integer,
  `retrying` integer,
  `skipped` integer,
  `processed` integer,
  `error_message` text,
  `source` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `cron_runs_job_name_idx` ON `cron_runs` (`job_name`);
--> statement-breakpoint
CREATE INDEX `cron_runs_success_idx` ON `cron_runs` (`success`);
--> statement-breakpoint
CREATE INDEX `cron_runs_started_at_idx` ON `cron_runs` (`started_at`);
--> statement-breakpoint

CREATE TABLE `ops_alerts` (
  `fingerprint` text PRIMARY KEY NOT NULL,
  `last_sent_at` integer NOT NULL,
  `last_payload` text NOT NULL,
  `created_at` integer NOT NULL,
  `updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ops_alerts_last_sent_at_idx` ON `ops_alerts` (`last_sent_at`);
