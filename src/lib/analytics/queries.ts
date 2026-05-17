import { and, asc, desc, eq, gte, sql } from "drizzle-orm";
import type { BaseSQLiteDatabase } from "drizzle-orm/sqlite-core";
import * as schema from "../../do/schema";
import {
  EMPTY_WEB_VITAL_GROUP,
  type AnalyticsWindow,
  type ArticleAnalyticsRow,
  type WebVitalGroup,
} from "./types";

type DB = BaseSQLiteDatabase<"sync", unknown, typeof schema>;

export interface SiteWideTotals {
  pageviews24h: number;
  pageviews7d: number;
  pageviews30d: number;
  visits24h: number;
  visits7d: number;
  visits30d: number;
}

export interface SiteWidePageviewSeries {
  ts: number[];
  pv: number[];
}

export interface AnalyticsSnapshotInput {
  slug: string;
  pageviews24h: number;
  visits24h: number;
  pageviews7d: number;
  visits7d: number;
  pageviews30d: number;
  visits30d: number;
  webVitalsJson: string;
  capturedAtSec: number;
}

// ---------- Reads ----------

export async function getLatestAnalyticsBySlug(
  db: DB,
  slug: string,
): Promise<ArticleAnalyticsRow | null> {
  const rows = await db
    .select()
    .from(schema.articleAnalyticsSnapshots)
    .where(eq(schema.articleAnalyticsSnapshots.articleSlug, slug))
    .orderBy(desc(schema.articleAnalyticsSnapshots.capturedAt))
    .limit(1);
  const row = rows[0];
  return row ? rowToAnalytics(row) : null;
}

export async function getLatestAnalyticsBySlugs(
  db: DB,
  slugs: string[],
): Promise<Map<string, ArticleAnalyticsRow>> {
  const map = new Map<string, ArticleAnalyticsRow>();
  if (slugs.length === 0) return map;

  const rows = await db.all<AnalyticsSnapshotRow>(sql`
    WITH latest AS (
      SELECT article_slug, MAX(captured_at) AS max_ts
      FROM ${schema.articleAnalyticsSnapshots}
      WHERE article_slug IN ${slugs}
      GROUP BY article_slug
    )
    SELECT
      s.id,
      s.article_slug,
      s.pageviews_24h, s.visits_24h,
      s.pageviews_7d,  s.visits_7d,
      s.pageviews_30d, s.visits_30d,
      s.web_vitals_json,
      s.captured_at
    FROM ${schema.articleAnalyticsSnapshots} s
    INNER JOIN latest l
      ON s.article_slug = l.article_slug
      AND s.captured_at = l.max_ts
  `);

  for (const row of rows) {
    const a = rowToAnalyticsRaw(row);
    map.set(a.articleSlug, a);
  }
  return map;
}

export async function getAnalyticsHistoryBySlug(
  db: DB,
  slug: string,
  opts: { sinceUnixSec?: number; limit?: number } = {},
): Promise<ArticleAnalyticsRow[]> {
  const sinceUnixSec =
    opts.sinceUnixSec ?? Math.floor((Date.now() - 30 * 86_400_000) / 1000);
  const limit = opts.limit ?? 240;

  const rows = await db
    .select()
    .from(schema.articleAnalyticsSnapshots)
    .where(
      and(
        eq(schema.articleAnalyticsSnapshots.articleSlug, slug),
        gte(schema.articleAnalyticsSnapshots.capturedAt, sinceUnixSec),
      ),
    )
    .orderBy(asc(schema.articleAnalyticsSnapshots.capturedAt))
    .limit(limit);

  return rows.map(rowToAnalytics);
}

export async function getSiteWideTotals(db: DB): Promise<SiteWideTotals> {
  const rows = await db.all<{
    pv24h: number;
    pv7d: number;
    pv30d: number;
    v24h: number;
    v7d: number;
    v30d: number;
  }>(sql`
    WITH latest AS (
      SELECT article_slug, MAX(captured_at) AS max_ts
      FROM ${schema.articleAnalyticsSnapshots}
      GROUP BY article_slug
    )
    SELECT
      COALESCE(SUM(s.pageviews_24h), 0) AS pv24h,
      COALESCE(SUM(s.pageviews_7d), 0)  AS pv7d,
      COALESCE(SUM(s.pageviews_30d), 0) AS pv30d,
      COALESCE(SUM(s.visits_24h), 0)    AS v24h,
      COALESCE(SUM(s.visits_7d), 0)     AS v7d,
      COALESCE(SUM(s.visits_30d), 0)    AS v30d
    FROM ${schema.articleAnalyticsSnapshots} s
    INNER JOIN latest l
      ON s.article_slug = l.article_slug
      AND s.captured_at = l.max_ts
  `);
  const row = rows[0];
  return {
    pageviews24h: Number(row?.pv24h ?? 0),
    pageviews7d: Number(row?.pv7d ?? 0),
    pageviews30d: Number(row?.pv30d ?? 0),
    visits24h: Number(row?.v24h ?? 0),
    visits7d: Number(row?.v7d ?? 0),
    visits30d: Number(row?.v30d ?? 0),
  };
}

export async function getSiteWidePageviewHistory(
  db: DB,
  days: number,
): Promise<SiteWidePageviewSeries> {
  const sinceUnixSec = Math.floor((Date.now() - days * 86_400_000) / 1000);

  const rows = await db.all<{ ts: number; pv: number }>(sql`
    SELECT
      captured_at AS ts,
      COALESCE(SUM(pageviews_24h), 0) AS pv
    FROM ${schema.articleAnalyticsSnapshots}
    WHERE captured_at >= ${sinceUnixSec}
    GROUP BY captured_at
    ORDER BY captured_at ASC
  `);

  const ts: number[] = [];
  const pv: number[] = [];
  for (const row of rows) {
    ts.push(Number(row.ts));
    pv.push(Number(row.pv));
  }
  return { ts, pv };
}

// ---------- Writes ----------

export async function insertAnalyticsSnapshot(
  db: DB,
  input: AnalyticsSnapshotInput,
): Promise<void> {
  await db
    .insert(schema.articleAnalyticsSnapshots)
    .values({
      articleSlug: input.slug,
      pageviews24h: input.pageviews24h,
      visits24h: input.visits24h,
      pageviews7d: input.pageviews7d,
      visits7d: input.visits7d,
      pageviews30d: input.pageviews30d,
      visits30d: input.visits30d,
      webVitalsJson: input.webVitalsJson,
      capturedAt: input.capturedAtSec,
    })
    .onConflictDoNothing();
}

// ---------- File-local helpers ----------

function rowToAnalytics(
  row: typeof schema.articleAnalyticsSnapshots.$inferSelect,
): ArticleAnalyticsRow {
  return {
    articleSlug: row.articleSlug,
    pageviews24h: Number(row.pageviews24h ?? 0),
    visits24h: Number(row.visits24h ?? 0),
    pageviews7d: Number(row.pageviews7d ?? 0),
    visits7d: Number(row.visits7d ?? 0),
    pageviews30d: Number(row.pageviews30d ?? 0),
    visits30d: Number(row.visits30d ?? 0),
    webVitals: parseWebVitals(row.webVitalsJson),
    capturedAt: new Date(Number(row.capturedAt) * 1000),
  };
}

interface AnalyticsSnapshotRow {
  id: number;
  article_slug: string;
  pageviews_24h: number;
  visits_24h: number;
  pageviews_7d: number;
  visits_7d: number;
  pageviews_30d: number;
  visits_30d: number;
  web_vitals_json: string | null;
  captured_at: number;
}

function rowToAnalyticsRaw(row: AnalyticsSnapshotRow): ArticleAnalyticsRow {
  return {
    articleSlug: row.article_slug,
    pageviews24h: Number(row.pageviews_24h ?? 0),
    visits24h: Number(row.visits_24h ?? 0),
    pageviews7d: Number(row.pageviews_7d ?? 0),
    visits7d: Number(row.visits_7d ?? 0),
    pageviews30d: Number(row.pageviews_30d ?? 0),
    visits30d: Number(row.visits_30d ?? 0),
    webVitals: parseWebVitals(row.web_vitals_json),
    capturedAt: new Date(Number(row.captured_at) * 1000),
  };
}

function parseWebVitals(
  json: string | null | undefined,
): Record<AnalyticsWindow, WebVitalGroup> {
  const fallback: Record<AnalyticsWindow, WebVitalGroup> = {
    "24h": EMPTY_WEB_VITAL_GROUP,
    "7d": EMPTY_WEB_VITAL_GROUP,
    "30d": EMPTY_WEB_VITAL_GROUP,
  };
  if (!json) return fallback;
  try {
    const parsed = JSON.parse(json) as Partial<Record<AnalyticsWindow, WebVitalGroup>>;
    return {
      "24h": parsed["24h"] ?? EMPTY_WEB_VITAL_GROUP,
      "7d": parsed["7d"] ?? EMPTY_WEB_VITAL_GROUP,
      "30d": parsed["30d"] ?? EMPTY_WEB_VITAL_GROUP,
    };
  } catch {
    return fallback;
  }
}
