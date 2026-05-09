/// <reference types="@cloudflare/workers-types" />
import { Resource } from "sst";
import { fetchArticleAnalytics } from "../lib/analytics/cloudflare-client";
import { roundDownToSlot, SLOT_3H_SECONDS } from "../lib/analytics/timeslot";
import { fetchArticleSlugs, insertAnalyticsSnapshot } from "./analytics-repository";

const handler: ExportedHandler = {
  async scheduled(_event, _env, ctx) {
    ctx.waitUntil(runAnalyticsPoll());
  },
};

export default handler;

const CONCURRENCY = 5;

async function runAnalyticsPoll(): Promise<void> {
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

  const capturedAt = roundDownToSlot(new Date(), SLOT_3H_SECONDS);
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
        await insertAnalyticsSnapshot(slug, snapshot, capturedAt);
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
