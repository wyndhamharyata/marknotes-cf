CREATE TABLE `article_analytics_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`article_slug` text NOT NULL,
	`pageviews_24h` integer DEFAULT 0 NOT NULL,
	`visits_24h` integer DEFAULT 0 NOT NULL,
	`pageviews_7d` integer DEFAULT 0 NOT NULL,
	`visits_7d` integer DEFAULT 0 NOT NULL,
	`pageviews_30d` integer DEFAULT 0 NOT NULL,
	`visits_30d` integer DEFAULT 0 NOT NULL,
	`web_vitals_json` text DEFAULT '{}' NOT NULL,
	`captured_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_aas_slug_captured` ON `article_analytics_snapshots` (`article_slug`,`captured_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_aas_slug_captured_unique` ON `article_analytics_snapshots` (`article_slug`,`captured_at`);--> statement-breakpoint
CREATE TABLE `replies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`article_slug` text NOT NULL,
	`message` text NOT NULL,
	`alias` text NOT NULL,
	`parent_id` integer,
	`moderation_status` integer DEFAULT 0 NOT NULL,
	`hide_publicity` integer DEFAULT 0 NOT NULL,
	`moderation_reason` text,
	`last_moderated_at` text,
	`deleted_at` text
);
