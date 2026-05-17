/// <reference types="@cloudflare/workers-types" />
import { Resource } from "sst";
import { fetchArticleAnalytics } from "../lib/analytics/cloudflare-client";
import { roundDownToSlot, SLOT_3H_SECONDS } from "../lib/analytics/timeslot";
import { getDoStubFromEnv, type EnvWithMainDo } from "../lib/db/do-client";

const handler: ExportedHandler<EnvWithMainDo> = {
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(runAnalyticsPoll(env));
  },
};

export default handler;

const CONCURRENCY = 5;

interface SlugListEntry {
  slug: string;
}

async function fetchArticleSlugs(baseUrl: string): Promise<string[]> {
  const trimmed = baseUrl.replace(/\/+$/, "");
  const url = `${trimmed}/api/articles.json`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetchArticleSlugs: ${res.status} ${res.statusText} from ${url}`);
  }

  const data = (await res.json()) as SlugListEntry[];
  return data.map((e) => e.slug);
}

async function runAnalyticsPoll(env: EnvWithMainDo): Promise<void> {
  console.log("Starting analytics poll...");

  const accountTag = Resource.CfAccountId.value;
  const siteTag = Resource.CfSiteTag.value;
  const token = Resource.CfAnalyticsToken.value;
  const email = Resource.CfAnalyticsEmail.value;
  const baseUrl = Resource.BaseUrl.value;

  if (!accountTag || !siteTag || !token || !email || !baseUrl) {
    throw new Error("Analytics secrets not configured via SST");
  }

  const slugs = await fetchArticleSlugs(baseUrl);
  if (slugs.length === 0) {
    console.log("No articles found; nothing to poll.");
    return;
  }

  console.log(`Polling analytics for ${slugs.length} articles`);

  const stub = getDoStubFromEnv(env);
  const capturedAt = roundDownToSlot(new Date(), SLOT_3H_SECONDS);
  const capturedAtSec = Math.floor(capturedAt.getTime() / 1000);
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < slugs.length; i += CONCURRENCY) {
    const batch = slugs.slice(i, i + CONCURRENCY);

    const results = await Promise.allSettled(
      batch.map(async (slug) => {
        const snapshot = await fetchArticleAnalytics({
          accountTag,
          siteTag,
          token,
          email,
          slug,
        });
        const webVitals = {
          "24h": snapshot.webVital24h,
          "7d": snapshot.webVital7d,
          "30d": snapshot.webVital30d,
        };
        await stub.insertAnalyticsSnapshot({
          slug,
          pageviews24h: snapshot.pageVisit24h.pageviews,
          visits24h: snapshot.pageVisit24h.visits,
          pageviews7d: snapshot.pageVisit7d.pageviews,
          visits7d: snapshot.pageVisit7d.visits,
          pageviews30d: snapshot.pageVisit30d.pageviews,
          visits30d: snapshot.pageVisit30d.visits,
          webVitalsJson: JSON.stringify(webVitals),
          capturedAtSec,
        });
        return slug;
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled") {
        ok++;
      } else {
        failed++;
        console.error("analytics poll slug failed:", r.reason);
      }
    }
  }

  console.log(`analytics poll: ${ok} ok / ${failed} failed`);
}
