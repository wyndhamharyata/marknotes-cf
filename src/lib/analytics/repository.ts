import { getTursoClient } from "../db/turso";
import { getAstroCredentials } from "../db/credentials";
import {
  EMPTY_WEB_VITAL_GROUP,
  type AnalyticsWindow,
  type ArticleAnalyticsRow,
  type WebVitalGroup,
} from "./types";

export interface HistoryOptions {
  since?: Date;
  limit?: number;
}

const SELECT_COLUMNS = `
  id,
  article_slug,
  pageviews_24h, visits_24h,
  pageviews_7d,  visits_7d,
  pageviews_30d, visits_30d,
  web_vitals_json,
  captured_at
`;

export async function getLatestAnalyticsBySlug(
  slug: string,
): Promise<ArticleAnalyticsRow | null> {
  const client = getTursoClient(getAstroCredentials());

  const result = await client.execute({
    sql: `
      SELECT ${SELECT_COLUMNS}
      FROM article_analytics_snapshots
      WHERE article_slug = ?
      ORDER BY captured_at DESC
      LIMIT 1
    `,
    args: [slug],
  });

  const row = result.rows[0];
  return row ? rowToAnalytics(row) : null;
}

export async function getLatestAnalyticsBySlugs(
  slugs: string[],
): Promise<Map<string, ArticleAnalyticsRow>> {
  const map = new Map<string, ArticleAnalyticsRow>();
  if (slugs.length === 0) return map;

  const client = getTursoClient(getAstroCredentials());
  const placeholders = slugs.map(() => "?").join(", ");

  const result = await client.execute({
    sql: `
      WITH latest AS (
        SELECT article_slug, MAX(captured_at) AS max_ts
        FROM article_analytics_snapshots
        WHERE article_slug IN (${placeholders})
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
      FROM article_analytics_snapshots s
      INNER JOIN latest l
        ON s.article_slug = l.article_slug
        AND s.captured_at = l.max_ts
    `,
    args: slugs,
  });

  for (const row of result.rows) {
    const analytics = rowToAnalytics(row);
    map.set(analytics.articleSlug, analytics);
  }
  return map;
}

export async function getAnalyticsHistoryBySlug(
  slug: string,
  opts: HistoryOptions = {},
): Promise<ArticleAnalyticsRow[]> {
  const sinceDate = opts.since ?? defaultSince();
  const limit = opts.limit ?? 240;

  const client = getTursoClient(getAstroCredentials());

  const result = await client.execute({
    sql: `
      SELECT ${SELECT_COLUMNS}
      FROM article_analytics_snapshots
      WHERE article_slug = ? AND captured_at >= ?
      ORDER BY captured_at ASC
      LIMIT ?
    `,
    args: [slug, Math.floor(sinceDate.getTime() / 1000), limit],
  });

  return result.rows.map(rowToAnalytics);
}

export interface SiteWideTotals {
  pageviews24h: number;
  pageviews7d: number;
  pageviews30d: number;
  visits24h: number;
  visits7d: number;
  visits30d: number;
}

export async function getSiteWideTotals(): Promise<SiteWideTotals> {
  const client = getTursoClient(getAstroCredentials());

  // Sum the latest snapshot for each article. Different articles can have
  // slightly different latest captured_at, so we pick MAX(captured_at) per slug.
  const result = await client.execute({
    sql: `
      WITH latest AS (
        SELECT article_slug, MAX(captured_at) AS max_ts
        FROM article_analytics_snapshots
        GROUP BY article_slug
      )
      SELECT
        COALESCE(SUM(s.pageviews_24h), 0) AS pv24h,
        COALESCE(SUM(s.pageviews_7d), 0)  AS pv7d,
        COALESCE(SUM(s.pageviews_30d), 0) AS pv30d,
        COALESCE(SUM(s.visits_24h), 0)    AS v24h,
        COALESCE(SUM(s.visits_7d), 0)     AS v7d,
        COALESCE(SUM(s.visits_30d), 0)    AS v30d
      FROM article_analytics_snapshots s
      INNER JOIN latest l
        ON s.article_slug = l.article_slug
        AND s.captured_at = l.max_ts
    `,
    args: [],
  });

  const row = result.rows[0];
  return {
    pageviews24h: Number(row?.pv24h ?? 0),
    pageviews7d: Number(row?.pv7d ?? 0),
    pageviews30d: Number(row?.pv30d ?? 0),
    visits24h: Number(row?.v24h ?? 0),
    visits7d: Number(row?.v7d ?? 0),
    visits30d: Number(row?.v30d ?? 0),
  };
}

export interface SiteWidePageviewSeries {
  ts: number[];
  pv: number[];
}

export async function getSiteWidePageviewHistory(
  days: number = 30,
): Promise<SiteWidePageviewSeries> {
  const sinceDate = new Date();
  sinceDate.setUTCDate(sinceDate.getUTCDate() - days);

  const client = getTursoClient(getAstroCredentials());

  // For each snapshot timestamp, sum pageviews_24h across all articles.
  // This gives a site-wide "rolling 24h pageview" trend at every snapshot.
  const result = await client.execute({
    sql: `
      SELECT
        captured_at AS ts,
        COALESCE(SUM(pageviews_24h), 0) AS pv
      FROM article_analytics_snapshots
      WHERE captured_at >= ?
      GROUP BY captured_at
      ORDER BY captured_at ASC
    `,
    args: [Math.floor(sinceDate.getTime() / 1000)],
  });

  const ts: number[] = [];
  const pv: number[] = [];
  for (const row of result.rows) {
    ts.push(Number(row.ts));
    pv.push(Number(row.pv));
  }
  return { ts, pv };
}

function defaultSince(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 30);
  return d;
}

type Row = Record<string, unknown>;

function rowToAnalytics(row: Row): ArticleAnalyticsRow {
  return {
    articleSlug: row.article_slug as string,
    pageviews24h: Number(row.pageviews_24h ?? 0),
    visits24h: Number(row.visits_24h ?? 0),
    pageviews7d: Number(row.pageviews_7d ?? 0),
    visits7d: Number(row.visits_7d ?? 0),
    pageviews30d: Number(row.pageviews_30d ?? 0),
    visits30d: Number(row.visits_30d ?? 0),
    webVitals: parseWebVitals(row.web_vitals_json as string | null),
    capturedAt: new Date(Number(row.captured_at) * 1000),
  };
}

function parseWebVitals(json: string | null): Record<AnalyticsWindow, WebVitalGroup> {
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
