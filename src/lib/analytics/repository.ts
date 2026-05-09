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
