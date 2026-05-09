-- Defensive dedup: keep the lowest id per (article_slug, captured_at).
-- The live cron almost certainly hasn't produced exact duplicates,
-- but this keeps the index creation below safe in any state.
DELETE FROM article_analytics_snapshots
WHERE id NOT IN (
  SELECT MIN(id)
  FROM article_analytics_snapshots
  GROUP BY article_slug, captured_at
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aas_slug_captured_unique
  ON article_analytics_snapshots(article_slug, captured_at);
