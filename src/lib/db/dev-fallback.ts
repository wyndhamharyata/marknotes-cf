// Dev-only MainDO substitute. Miniflare can't host the DO class via
// platformProxy, so locally we drive the same query functions against a
// better-sqlite3 file. Dynamically imported under `import.meta.env.DEV` so
// prod bundles never see better-sqlite3.
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import * as schema from "../../do/schema";
import * as commentsQ from "../comments/queries";
import * as analyticsQ from "../analytics/queries";
import { dumpSqlImpl } from "../seed/dump";

const DB_DIR = ".dev";
const DB_PATH = path.join(DB_DIR, "local.sqlite");
const STAGING_URL = process.env.STAGING_URL ?? "https://devread.mwyndham.dev";
const MIGRATION_TOKEN = process.env.MIGRATION_TOKEN;

async function initLocalDb() {
  fs.mkdirSync(DB_DIR, { recursive: true });
  const isFresh = !fs.existsSync(DB_PATH);

  const sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });

  // Read .sql from disk rather than the bundled migrations module — bundling
  // pulls .sql text-loader imports through Vite which we don't configure here.
  migrate(db, { migrationsFolder: "src/do/drizzle" });

  if (!isFresh) return db;

  if (!MIGRATION_TOKEN) {
    console.log(
      `[dev-fallback] Created empty ${DB_PATH}. Set MIGRATION_TOKEN in .env to auto-seed from staging on next dev start.`,
    );
    return db;
  }

  try {
    const url = `${STAGING_URL}/api/dump-do?token=${encodeURIComponent(MIGRATION_TOKEN)}`;
    console.log(`[dev-fallback] Fresh DB — fetching seed from ${STAGING_URL}...`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Dump endpoint returned ${res.status}: ${await res.text()}`);
    }
    const sql = await res.text();
    sqlite.exec(sql);
    const replyCount = (
      sqlite.prepare("SELECT COUNT(*) AS c FROM replies").get() as { c: number }
    ).c;
    const snapshotCount = (
      sqlite
        .prepare("SELECT COUNT(*) AS c FROM article_analytics_snapshots")
        .get() as { c: number }
    ).c;
    console.log(
      `[dev-fallback] Seeded ${DB_PATH}: ${replyCount} replies, ${snapshotCount} snapshots.`,
    );
  } catch (e) {
    console.warn(
      `[dev-fallback] Auto-seed from staging failed; starting with empty DB. ${e instanceof Error ? e.message : String(e)}`,
    );
  }

  return db;
}

const db = await initLocalDb();

// Mirrors MainDO's RPC surface; cast in do-client.ts.
export const devStub = {
  getCommentsBySlug: (slug: string) => commentsQ.getCommentsBySlug(db, slug),
  createComment: (input: Parameters<typeof commentsQ.createComment>[1]) =>
    commentsQ.createComment(db, input),
  createCommentWithModeration: (
    input: Parameters<typeof commentsQ.createCommentWithModeration>[1],
    moderationStatus: number,
  ) => commentsQ.createCommentWithModeration(db, input, moderationStatus),
  getCommentsForAdmin: (opts: commentsQ.GetCommentsForAdminInput) =>
    commentsQ.getCommentsForAdmin(db, opts),
  getCommentCounts: () => commentsQ.getCommentCounts(db),
  markCommentSafe: (id: number) => commentsQ.markCommentSafe(db, id),
  hideComment: (id: number) => commentsQ.hideComment(db, id),
  getUnmoderatedComments: (limit: number) => commentsQ.getUnmoderatedComments(db, limit),
  updateModerationStatus: (
    results: Parameters<typeof commentsQ.updateModerationStatus>[1],
  ) => commentsQ.updateModerationStatus(db, results),
  getLatestAnalyticsBySlug: (slug: string) =>
    analyticsQ.getLatestAnalyticsBySlug(db, slug),
  getLatestAnalyticsBySlugs: (slugs: string[]) =>
    analyticsQ.getLatestAnalyticsBySlugs(db, slugs),
  getAnalyticsHistoryBySlug: (
    slug: string,
    opts: { sinceUnixSec?: number; limit?: number } = {},
  ) => analyticsQ.getAnalyticsHistoryBySlug(db, slug, opts),
  getSiteWideTotals: () => analyticsQ.getSiteWideTotals(db),
  getSiteWidePageviewHistory: (days: number) =>
    analyticsQ.getSiteWidePageviewHistory(db, days),
  insertAnalyticsSnapshot: (input: analyticsQ.AnalyticsSnapshotInput) =>
    analyticsQ.insertAnalyticsSnapshot(db, input),
  dumpSql: () => dumpSqlImpl(db),
};
