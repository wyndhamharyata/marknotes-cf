import { getDoStub } from "../db/do-client";
import type { ArticleAnalyticsRow } from "./types";

export interface HistoryOptions {
  since?: Date;
  limit?: number;
}

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

export async function getLatestAnalyticsBySlug(
  slug: string,
): Promise<ArticleAnalyticsRow | null> {
  return getDoStub().getLatestAnalyticsBySlug(slug);
}

export async function getLatestAnalyticsBySlugs(
  slugs: string[],
): Promise<Map<string, ArticleAnalyticsRow>> {
  return getDoStub().getLatestAnalyticsBySlugs(slugs);
}

export async function getAnalyticsHistoryBySlug(
  slug: string,
  opts: HistoryOptions = {},
): Promise<ArticleAnalyticsRow[]> {
  const sinceUnixSec = opts.since
    ? Math.floor(opts.since.getTime() / 1000)
    : undefined;
  return getDoStub().getAnalyticsHistoryBySlug(slug, {
    sinceUnixSec,
    limit: opts.limit,
  });
}

export async function getSiteWideTotals(): Promise<SiteWideTotals> {
  return getDoStub().getSiteWideTotals();
}

export async function getSiteWidePageviewHistory(
  days: number = 30,
): Promise<SiteWidePageviewSeries> {
  return getDoStub().getSiteWidePageviewHistory(days);
}
