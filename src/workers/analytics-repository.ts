/**
 * Worker-specific repository for analytics polling.
 * Uses SST Resource directly to avoid `astro:env/server` import issues.
 */
import { Resource } from "sst";
import { getTursoClient, type TursoCredentials } from "../lib/db/turso";
import type { AnalyticsSnapshot } from "../lib/analytics/types";

interface SlugListEntry {
  slug: string;
}

function getWorkerCredentials(): TursoCredentials {
  const url = Resource.LibsqlUrl.value;
  const authToken = Resource.LibsqlAuthToken.value;

  if (!url || !authToken) {
    throw new Error("Database credentials not configured via SST secrets");
  }

  return { url, authToken };
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
  slug: string,
  snapshot: AnalyticsSnapshot,
  capturedAt: Date,
): Promise<void> {
  const client = getTursoClient(getWorkerCredentials());

  const webVitals = {
    "24h": snapshot.webVital24h,
    "7d": snapshot.webVital7d,
    "30d": snapshot.webVital30d,
  };

  await client.execute({
    sql: `
      INSERT OR IGNORE INTO article_analytics_snapshots (
        article_slug,
        pageviews_24h, visits_24h,
        pageviews_7d,  visits_7d,
        pageviews_30d, visits_30d,
        web_vitals_json,
        captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    args: [
      slug,
      snapshot.pageVisit24h.pageviews,
      snapshot.pageVisit24h.visits,
      snapshot.pageVisit7d.pageviews,
      snapshot.pageVisit7d.visits,
      snapshot.pageVisit30d.pageviews,
      snapshot.pageVisit30d.visits,
      JSON.stringify(webVitals),
      Math.floor(capturedAt.getTime() / 1000),
    ],
  });
}
