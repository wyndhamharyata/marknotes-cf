import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const articleAnalyticsSnapshots = sqliteTable(
  "article_analytics_snapshots",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    articleSlug: text("article_slug").notNull(),
    pageviews24h: integer("pageviews_24h").notNull().default(0),
    visits24h: integer("visits_24h").notNull().default(0),
    pageviews7d: integer("pageviews_7d").notNull().default(0),
    visits7d: integer("visits_7d").notNull().default(0),
    pageviews30d: integer("pageviews_30d").notNull().default(0),
    visits30d: integer("visits_30d").notNull().default(0),
    webVitalsJson: text("web_vitals_json").notNull().default("{}"),
    capturedAt: integer("captured_at").notNull(),
    createdAt: integer("created_at")
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_aas_slug_captured").on(t.articleSlug, t.capturedAt),
    uniqueIndex("idx_aas_slug_captured_unique").on(t.articleSlug, t.capturedAt),
  ],
);

export const replies = sqliteTable("replies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  articleSlug: text("article_slug").notNull(),
  message: text("message").notNull(),
  alias: text("alias").notNull(),
  parentId: integer("parent_id"),
  moderationStatus: integer("moderation_status").notNull().default(0),
  hidePublicity: integer("hide_publicity").notNull().default(0),
  moderationReason: text("moderation_reason"),
  lastModeratedAt: text("last_moderated_at"),
  deletedAt: text("deleted_at"),
});
