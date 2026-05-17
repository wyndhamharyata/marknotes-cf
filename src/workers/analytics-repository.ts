/**
 * Worker-specific repository for analytics polling.
 * Targets the MainDO Durable Object via the env-bound stub.
 */
import { getDoStubFromEnv, type EnvWithMainDo } from "../lib/db/do-client";
import type { AnalyticsSnapshot } from "../lib/analytics/types";

interface SlugListEntry {
  slug: string;
}

export async function fetchArticleSlugs(baseUrl: string): Promise<string[]> {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const url = `${trimmed}/api/articles.json`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetchArticleSlugs: ${res.status} ${res.statusText} from ${url}`);
  }

  const data = (await res.json()) as SlugListEntry[];
  return data.map((e) => e.slug);
}

export async function insertAnalyticsSnapshot(
  env: EnvWithMainDo,
  slug: string,
  snapshot: AnalyticsSnapshot,
  capturedAt: Date,
): Promise<void> {
  const webVitals = {
    "24h": snapshot.webVital24h,
    "7d": snapshot.webVital7d,
    "30d": snapshot.webVital30d,
  };

  return getDoStubFromEnv(env).insertAnalyticsSnapshot({
    slug,
    pageviews24h: snapshot.pageVisit24h.pageviews,
    visits24h: snapshot.pageVisit24h.visits,
    pageviews7d: snapshot.pageVisit7d.pageviews,
    visits7d: snapshot.pageVisit7d.visits,
    pageviews30d: snapshot.pageVisit30d.pageviews,
    visits30d: snapshot.pageVisit30d.visits,
    webVitalsJson: JSON.stringify(webVitals),
    capturedAtSec: Math.floor(capturedAt.getTime() / 1000),
  });
}
