CREATE TABLE IF NOT EXISTS article_analytics_snapshots (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  article_slug     TEXT    NOT NULL,
  pageviews_24h    INTEGER NOT NULL DEFAULT 0,
  visits_24h       INTEGER NOT NULL DEFAULT 0,
  pageviews_7d     INTEGER NOT NULL DEFAULT 0,
  visits_7d        INTEGER NOT NULL DEFAULT 0,
  pageviews_30d    INTEGER NOT NULL DEFAULT 0,
  visits_30d       INTEGER NOT NULL DEFAULT 0,
  web_vitals_json  TEXT    NOT NULL DEFAULT '{}',
  captured_at      INTEGER NOT NULL,
  created_at       INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_aas_slug_captured
  ON article_analytics_snapshots(article_slug, captured_at DESC);
