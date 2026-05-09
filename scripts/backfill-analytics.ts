#!/usr/bin/env tsx
import { parseArgs } from "node:util";
import { createClient } from "@libsql/client";
import { fetchArticleAnalytics } from "../src/lib/analytics/cloudflare-client";
import { roundDownToSlot, SLOT_3H_SECONDS } from "../src/lib/analytics/timeslot";
import type { AnalyticsSnapshot } from "../src/lib/analytics/types";

const REQUIRED_ENV = [
  "LIBSQL_URL",
  "LIBSQL_AUTH_TOKEN",
  "CF_ACCOUNT_ID",
  "CF_SITE_TAG",
  "CF_ANALYTICS_TOKEN",
  "CF_ANALYTICS_EMAIL",
  "BASE_URL",
] as const;

const CONCURRENCY = 5;

main().catch((err) => {
  console.error("backfill failed:", err);
  process.exit(1);
});

async function main() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(", ")}`);
    console.error("Add them to .env, then run: npm run backfill");
    process.exit(1);
  }

  const { values } = parseArgs({
    options: {
      slug: { type: "string" },
      days: { type: "string", default: "30" },
    },
  });

  const days = Number.parseInt(values.days as string, 10);
  if (!Number.isFinite(days) || days < 1) {
    console.error(`Invalid --days value: ${values.days}`);
    process.exit(1);
  }

  const baseUrl = process.env.BASE_URL!;
  const cf = {
    accountTag: process.env.CF_ACCOUNT_ID!,
    siteTag: process.env.CF_SITE_TAG!,
    token: process.env.CF_ANALYTICS_TOKEN!,
    email: process.env.CF_ANALYTICS_EMAIL!,
  };

  const client = createClient({
    url: process.env.LIBSQL_URL!,
    authToken: process.env.LIBSQL_AUTH_TOKEN!,
  });

  const slugs = values.slug ? [values.slug as string] : await fetchArticleSlugs(baseUrl);
  if (slugs.length === 0) {
    console.log("No articles to backfill.");
    return;
  }

  const now = new Date();
  const latestSlot = roundDownToSlot(now, SLOT_3H_SECONDS);
  const slotsCount = days * 8;

  // Newest first; reversed at insert time so logs read chronologically.
  const expectedSlots: Date[] = [];
  for (let i = 0; i < slotsCount; i++) {
    expectedSlots.push(new Date(latestSlot.getTime() - i * SLOT_3H_SECONDS * 1000));
  }
  const earliestSlot = expectedSlots[expectedSlots.length - 1];

  console.log(
    `Target: ${process.env.LIBSQL_URL}\n` +
      `Slugs: ${slugs.length}\n` +
      `Window: ${earliestSlot.toISOString()} → ${latestSlot.toISOString()} (${slotsCount} slots × ${slugs.length} = ${slotsCount * slugs.length} potential fetches)\n`,
  );

  let totalOk = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const slug of slugs) {
    let filledBuckets: Set<number>;
    try {
      filledBuckets = await loadFilledBuckets(client, slug, earliestSlot);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`\n! could not load existing snapshots for ${slug}: ${msg}`);
      console.error(`  skipping slug to avoid double-writes; re-run later`);
      totalFailed++;
      continue;
    }
    const gaps = expectedSlots
      .filter((slot) => !filledBuckets.has(Math.floor(slot.getTime() / 1000)))
      .reverse(); // oldest → newest for nicer log progression

    console.log(
      `\n${slug}: ${expectedSlots.length} expected, ${filledBuckets.size} filled, ${gaps.length} gaps to fill`,
    );

    if (gaps.length === 0) {
      totalSkipped += expectedSlots.length;
      continue;
    }

    let slugOk = 0;
    let slugFailed = 0;

    for (let i = 0; i < gaps.length; i += CONCURRENCY) {
      const batch = gaps.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(batch.map((slot) => fillGap(client, cf, slug, slot)));
      for (let j = 0; j < results.length; j++) {
        const r = results[j];
        if (r.status === "fulfilled") {
          slugOk++;
        } else {
          slugFailed++;
          const msg = r.reason instanceof Error ? r.reason.message : String(r.reason);
          console.error(`  ✗ ${slug} @ ${batch[j].toISOString()}: ${msg}`);
        }
      }
      const done = Math.min(i + CONCURRENCY, gaps.length);
      process.stdout.write(`\r  progress: ${done}/${gaps.length}`);
    }

    process.stdout.write(`\n  ✓ ${slug}: ${slugOk} ok, ${slugFailed} failed\n`);
    totalOk += slugOk;
    totalFailed += slugFailed;
  }

  console.log(
    `\nBackfill done. Wrote ${totalOk} snapshots; ${totalFailed} failed; ${totalSkipped} slots already present.`,
  );

  if (totalFailed > 0) {
    process.exitCode = 1;
  }
}

async function fetchArticleSlugs(baseUrl: string): Promise<string[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/api/articles.json`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fetchArticleSlugs: ${res.status} ${res.statusText} from ${url}`);
  }
  const data = (await res.json()) as { slug: string }[];
  return data.map((e) => e.slug);
}

async function loadFilledBuckets(
  client: ReturnType<typeof createClient>,
  slug: string,
  since: Date,
): Promise<Set<number>> {
  const result = await client.execute({
    sql: "SELECT captured_at FROM article_analytics_snapshots WHERE article_slug = ? AND captured_at >= ?",
    args: [slug, Math.floor(since.getTime() / 1000)],
  });
  const buckets = new Set<number>();
  for (const row of result.rows) {
    const ts = Number(row.captured_at);
    if (Number.isFinite(ts)) {
      buckets.add(Math.floor(ts / SLOT_3H_SECONDS) * SLOT_3H_SECONDS);
    }
  }
  return buckets;
}

interface CfCreds {
  accountTag: string;
  siteTag: string;
  token: string;
  email: string;
}

async function fillGap(
  client: ReturnType<typeof createClient>,
  cf: CfCreds,
  slug: string,
  slot: Date,
): Promise<void> {
  const snapshot = await fetchWithRateLimitRetry(cf, slug, slot);
  await insertSnapshot(client, slug, snapshot, slot);
}

async function fetchWithRateLimitRetry(cf: CfCreds, slug: string, slot: Date) {
  const maxRetries = 3;
  let lastErr: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetchArticleAnalytics({ ...cf, slug, endTime: slot });
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      if (!msg.includes("Rate limiter") || attempt === maxRetries) throw err;
      const waitMs = 60_000 * (attempt + 1); // 60s, 120s, 180s
      process.stdout.write(`\n  ⏸ rate-limited, sleeping ${waitMs / 1000}s before retry...\n`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  throw lastErr;
}

async function insertSnapshot(
  client: ReturnType<typeof createClient>,
  slug: string,
  snapshot: AnalyticsSnapshot,
  capturedAt: Date,
): Promise<void> {
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
