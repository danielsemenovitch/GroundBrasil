CREATE TABLE `articles` (
	`id` text PRIMARY KEY NOT NULL,
	`source_id` text NOT NULL,
	`url` text NOT NULL,
	`published_at` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_url_unique` ON `articles` (`url`);--> statement-breakpoint
CREATE INDEX `articles_published_idx` ON `articles` (`published_at`);--> statement-breakpoint
CREATE TABLE `editions` (
	`id` text PRIMARY KEY NOT NULL,
	`generated_at` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingestion_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`started_at` text NOT NULL,
	`finished_at` text,
	`status` text NOT NULL,
	`article_count` integer DEFAULT 0 NOT NULL,
	`detail` text
);
--> statement-breakpoint
CREATE TABLE `pipeline_state` (
	`id` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
