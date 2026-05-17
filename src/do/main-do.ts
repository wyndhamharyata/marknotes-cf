import { DurableObject } from "cloudflare:workers";
import { drizzle, type DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "./drizzle/migrations";
import * as schema from "./schema";
import * as commentsQ from "../lib/comments/queries";
import * as analyticsQ from "../lib/analytics/queries";
import type {
  CreateCommentInput,
  ModerationResult,
} from "../lib/comments/types";

export type { GetCommentsForAdminInput } from "../lib/comments/queries";
export type {
  SiteWideTotals,
  SiteWidePageviewSeries,
  AnalyticsSnapshotInput,
} from "../lib/analytics/queries";

export class MainDO extends DurableObject {
  private db: DrizzleSqliteDODatabase<typeof schema>;

  constructor(state: DurableObjectState, env: unknown) {
    super(state, env as never);
    this.db = drizzle(state.storage, { schema, logger: false });
    state.blockConcurrencyWhile(async () => {
      await migrate(this.db, migrations);
    });
  }

  // ---------- Comments (public) ----------

  getCommentsBySlug(slug: string) {
    return commentsQ.getCommentsBySlug(this.db, slug);
  }

  createComment(input: CreateCommentInput) {
    return commentsQ.createComment(this.db, input);
  }

  createCommentWithModeration(input: CreateCommentInput, moderationStatus: number) {
    return commentsQ.createCommentWithModeration(this.db, input, moderationStatus);
  }

  // ---------- Comments (admin) ----------

  getCommentsForAdmin(opts: commentsQ.GetCommentsForAdminInput) {
    return commentsQ.getCommentsForAdmin(this.db, opts);
  }

  getCommentCounts() {
    return commentsQ.getCommentCounts(this.db);
  }

  markCommentSafe(id: number) {
    return commentsQ.markCommentSafe(this.db, id);
  }

  hideComment(id: number) {
    return commentsQ.hideComment(this.db, id);
  }

  // ---------- Comments (cron) ----------

  getUnmoderatedComments(limit: number) {
    return commentsQ.getUnmoderatedComments(this.db, limit);
  }

  updateModerationStatus(results: ModerationResult[]) {
    return commentsQ.updateModerationStatus(this.db, results);
  }

  // ---------- Analytics (read) ----------

  getLatestAnalyticsBySlug(slug: string) {
    return analyticsQ.getLatestAnalyticsBySlug(this.db, slug);
  }

  getLatestAnalyticsBySlugs(slugs: string[]) {
    return analyticsQ.getLatestAnalyticsBySlugs(this.db, slugs);
  }

  getAnalyticsHistoryBySlug(
    slug: string,
    opts: { sinceUnixSec?: number; limit?: number } = {},
  ) {
    return analyticsQ.getAnalyticsHistoryBySlug(this.db, slug, opts);
  }

  getSiteWideTotals() {
    return analyticsQ.getSiteWideTotals(this.db);
  }

  getSiteWidePageviewHistory(days: number) {
    return analyticsQ.getSiteWidePageviewHistory(this.db, days);
  }

  // ---------- Analytics (cron write) ----------

  insertAnalyticsSnapshot(input: analyticsQ.AnalyticsSnapshotInput) {
    return analyticsQ.insertAnalyticsSnapshot(this.db, input);
  }
}
