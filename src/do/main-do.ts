import { DurableObject } from "cloudflare:workers";
import { and, asc, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { drizzle, type DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { migrate } from "drizzle-orm/durable-sqlite/migrator";
import migrations from "./drizzle/migrations";
import * as schema from "./schema";
import {
  EMPTY_WEB_VITAL_GROUP,
  type AnalyticsWindow,
  type ArticleAnalyticsRow,
  type WebVitalGroup,
} from "../lib/analytics/types";
import {
  ModerationStatus,
  type AdminComment,
  type CommentCounts,
  type CreateCommentInput,
  type ModerationInput,
  type ModerationResult,
  type ModerationStatusType,
  type Reply,
} from "../lib/comments/types";

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

export interface GetCommentsForAdminInput {
  status: ModerationStatusType | null;
  page: number;
  limit: number;
}

export interface AnalyticsSnapshotInput {
  slug: string;
  pageviews24h: number;
  visits24h: number;
  pageviews7d: number;
  visits7d: number;
  pageviews30d: number;
  visits30d: number;
  webVitalsJson: string;
  capturedAtSec: number;
}

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

  async getCommentsBySlug(articleSlug: string): Promise<Reply[]> {
    const rows = await this.db
      .select({
        id: schema.replies.id,
        createdAt: schema.replies.createdAt,
        message: schema.replies.message,
        alias: schema.replies.alias,
        parentId: schema.replies.parentId,
        articleSlug: schema.replies.articleSlug,
        moderationStatus: schema.replies.moderationStatus,
        hidePublicity: schema.replies.hidePublicity,
      })
      .from(schema.replies)
      .where(
        and(
          eq(schema.replies.articleSlug, articleSlug),
          isNull(schema.replies.deletedAt),
        ),
      )
      .orderBy(desc(schema.replies.createdAt));

    return rows.map(rowToReply);
  }

  async createComment(input: CreateCommentInput): Promise<number> {
    const result = await this.db
      .insert(schema.replies)
      .values({
        createdAt: sql`datetime('now')`,
        updatedAt: sql`datetime('now')`,
        articleSlug: input.articleSlug,
        message: input.message,
        alias: input.alias,
        parentId: input.parentId,
        hidePublicity: 0,
        moderationStatus: 0,
      })
      .returning({ id: schema.replies.id });
    return result[0]!.id;
  }

  async createCommentWithModeration(
    input: CreateCommentInput,
    moderationStatus: number,
  ): Promise<number> {
    const result = await this.db
      .insert(schema.replies)
      .values({
        createdAt: sql`datetime('now')`,
        updatedAt: sql`datetime('now')`,
        articleSlug: input.articleSlug,
        message: input.message,
        alias: input.alias,
        parentId: input.parentId,
        hidePublicity: 0,
        moderationStatus,
      })
      .returning({ id: schema.replies.id });
    return result[0]!.id;
  }

  // ---------- Comments (admin) ----------

  async getCommentsForAdmin(
    options: GetCommentsForAdminInput,
  ): Promise<{ comments: AdminComment[]; total: number }> {
    const { status, page, limit } = options;
    const offset = (page - 1) * limit;

    const baseWhere = and(
      isNull(schema.replies.deletedAt),
      eq(schema.replies.hidePublicity, 0),
      ...(status !== null ? [eq(schema.replies.moderationStatus, status)] : []),
    );

    const countRow = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(schema.replies)
      .where(baseWhere);
    const total = Number(countRow[0]?.count ?? 0);

    const parents = schema.replies;
    const r = schema.replies;
    // Drizzle doesn't allow joining a table to itself with the same alias; use a raw SQL select.
    const rowsResult = await this.db.all<{
      id: number;
      created_at: string;
      message: string;
      alias: string;
      parent_id: number | null;
      article_slug: string;
      moderation_status: number;
      hide_publicity: number;
      moderation_reason: string | null;
      last_moderated_at: string | null;
      p_id: number | null;
      p_created_at: string | null;
      p_message: string | null;
      p_alias: string | null;
      p_parent_id: number | null;
      p_article_slug: string | null;
      p_moderation_status: number | null;
      p_hide_publicity: number | null;
    }>(sql`
      SELECT
        r.id, r.created_at, r.message, r.alias, r.parent_id, r.article_slug,
        r.moderation_status, r.hide_publicity, r.moderation_reason, r.last_moderated_at,
        p.id AS p_id, p.created_at AS p_created_at, p.message AS p_message,
        p.alias AS p_alias, p.parent_id AS p_parent_id, p.article_slug AS p_article_slug,
        p.moderation_status AS p_moderation_status, p.hide_publicity AS p_hide_publicity
      FROM ${r} r
      LEFT JOIN ${parents} p ON r.parent_id = p.id
      WHERE r.deleted_at IS NULL
        AND r.hide_publicity = 0
        ${status !== null ? sql`AND r.moderation_status = ${status}` : sql``}
      ORDER BY r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const commentIds = rowsResult.map((row) => row.id);
    const childrenMap = new Map<number, Reply[]>();
    if (commentIds.length > 0) {
      const childrenRows = await this.db
        .select({
          id: schema.replies.id,
          createdAt: schema.replies.createdAt,
          message: schema.replies.message,
          alias: schema.replies.alias,
          parentId: schema.replies.parentId,
          articleSlug: schema.replies.articleSlug,
          moderationStatus: schema.replies.moderationStatus,
          hidePublicity: schema.replies.hidePublicity,
        })
        .from(schema.replies)
        .where(
          and(
            inArray(schema.replies.parentId, commentIds),
            isNull(schema.replies.deletedAt),
          ),
        )
        .orderBy(asc(schema.replies.createdAt));

      for (const row of childrenRows) {
        const pid = row.parentId as number;
        if (!childrenMap.has(pid)) childrenMap.set(pid, []);
        childrenMap.get(pid)!.push(rowToReply(row));
      }
    }

    const comments: AdminComment[] = rowsResult.map((row) => {
      const parent: Reply | null = row.p_id
        ? {
            id: row.p_id,
            createdAt: new Date(row.p_created_at as string),
            message: row.p_message as string,
            alias: row.p_alias as string,
            parentId: row.p_parent_id,
            articleSlug: row.p_article_slug as string,
            moderationStatus: ((row.p_moderation_status as number) ??
              ModerationStatus.UNVERIFIED) as ModerationStatusType,
            hidePublicity: Boolean(row.p_hide_publicity),
          }
        : null;

      return {
        id: row.id,
        createdAt: new Date(row.created_at),
        message: row.message,
        alias: row.alias,
        parentId: row.parent_id,
        articleSlug: row.article_slug,
        moderationStatus: ((row.moderation_status as number) ??
          ModerationStatus.UNVERIFIED) as ModerationStatusType,
        hidePublicity: Boolean(row.hide_publicity),
        moderationReason: row.moderation_reason ?? null,
        lastModeratedAt: row.last_moderated_at ? new Date(row.last_moderated_at) : null,
        parent,
        children: childrenMap.get(row.id) ?? [],
        articleTitle: "",
      };
    });

    return { comments, total };
  }

  async getCommentCounts(): Promise<CommentCounts> {
    const rows = await this.db.all<{
      all_count: number;
      unverified: number;
      ok: number;
      warning: number;
      dangerous: number;
    }>(sql`
      SELECT
        COUNT(*) AS all_count,
        SUM(CASE WHEN moderation_status = 0 THEN 1 ELSE 0 END) AS unverified,
        SUM(CASE WHEN moderation_status = 1 THEN 1 ELSE 0 END) AS ok,
        SUM(CASE WHEN moderation_status = 2 THEN 1 ELSE 0 END) AS warning,
        SUM(CASE WHEN moderation_status = 3 THEN 1 ELSE 0 END) AS dangerous
      FROM ${schema.replies}
      WHERE deleted_at IS NULL AND hide_publicity = 0
    `);
    const row = rows[0];
    return {
      all: Number(row?.all_count ?? 0),
      unverified: Number(row?.unverified ?? 0),
      ok: Number(row?.ok ?? 0),
      warning: Number(row?.warning ?? 0),
      dangerous: Number(row?.dangerous ?? 0),
    };
  }

  async markCommentSafe(id: number): Promise<void> {
    await this.db
      .update(schema.replies)
      .set({
        moderationStatus: ModerationStatus.OK,
        lastModeratedAt: sql`datetime('now')`,
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(schema.replies.id, id));
  }

  async hideComment(id: number): Promise<void> {
    await this.db
      .update(schema.replies)
      .set({
        hidePublicity: 1,
        updatedAt: sql`datetime('now')`,
      })
      .where(eq(schema.replies.id, id));
  }

  // ---------- Moderation (cron) ----------

  async getUnmoderatedComments(limit: number): Promise<ModerationInput[]> {
    const rows = await this.db
      .select({ id: schema.replies.id, message: schema.replies.message })
      .from(schema.replies)
      .where(
        and(
          isNull(schema.replies.lastModeratedAt),
          isNull(schema.replies.deletedAt),
          eq(schema.replies.moderationStatus, ModerationStatus.UNVERIFIED),
        ),
      )
      .orderBy(asc(schema.replies.createdAt))
      .limit(limit);
    return rows;
  }

  async updateModerationStatus(results: ModerationResult[]): Promise<void> {
    if (results.length === 0) return;
    for (const r of results) {
      await this.db
        .update(schema.replies)
        .set({
          moderationStatus: r.moderation_status,
          moderationReason: r.moderation_reason,
          lastModeratedAt: sql`datetime('now')`,
          updatedAt: sql`datetime('now')`,
        })
        .where(eq(schema.replies.id, r.id));
    }
  }

  // ---------- Analytics (read) ----------

  async getLatestAnalyticsBySlug(slug: string): Promise<ArticleAnalyticsRow | null> {
    const rows = await this.db
      .select()
      .from(schema.articleAnalyticsSnapshots)
      .where(eq(schema.articleAnalyticsSnapshots.articleSlug, slug))
      .orderBy(desc(schema.articleAnalyticsSnapshots.capturedAt))
      .limit(1);
    const row = rows[0];
    return row ? rowToAnalytics(row) : null;
  }

  async getLatestAnalyticsBySlugs(
    slugs: string[],
  ): Promise<Map<string, ArticleAnalyticsRow>> {
    const map = new Map<string, ArticleAnalyticsRow>();
    if (slugs.length === 0) return map;

    const rows = await this.db.all<AnalyticsSnapshotRow>(sql`
      WITH latest AS (
        SELECT article_slug, MAX(captured_at) AS max_ts
        FROM ${schema.articleAnalyticsSnapshots}
        WHERE article_slug IN ${slugs}
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
      FROM ${schema.articleAnalyticsSnapshots} s
      INNER JOIN latest l
        ON s.article_slug = l.article_slug
        AND s.captured_at = l.max_ts
    `);

    for (const row of rows) {
      const a = rowToAnalyticsRaw(row);
      map.set(a.articleSlug, a);
    }
    return map;
  }

  async getAnalyticsHistoryBySlug(
    slug: string,
    opts: { sinceUnixSec?: number; limit?: number } = {},
  ): Promise<ArticleAnalyticsRow[]> {
    const sinceUnixSec =
      opts.sinceUnixSec ?? Math.floor((Date.now() - 30 * 86_400_000) / 1000);
    const limit = opts.limit ?? 240;

    const rows = await this.db
      .select()
      .from(schema.articleAnalyticsSnapshots)
      .where(
        and(
          eq(schema.articleAnalyticsSnapshots.articleSlug, slug),
          gte(schema.articleAnalyticsSnapshots.capturedAt, sinceUnixSec),
        ),
      )
      .orderBy(asc(schema.articleAnalyticsSnapshots.capturedAt))
      .limit(limit);

    return rows.map(rowToAnalytics);
  }

  async getSiteWideTotals(): Promise<SiteWideTotals> {
    const rows = await this.db.all<{
      pv24h: number;
      pv7d: number;
      pv30d: number;
      v24h: number;
      v7d: number;
      v30d: number;
    }>(sql`
      WITH latest AS (
        SELECT article_slug, MAX(captured_at) AS max_ts
        FROM ${schema.articleAnalyticsSnapshots}
        GROUP BY article_slug
      )
      SELECT
        COALESCE(SUM(s.pageviews_24h), 0) AS pv24h,
        COALESCE(SUM(s.pageviews_7d), 0)  AS pv7d,
        COALESCE(SUM(s.pageviews_30d), 0) AS pv30d,
        COALESCE(SUM(s.visits_24h), 0)    AS v24h,
        COALESCE(SUM(s.visits_7d), 0)     AS v7d,
        COALESCE(SUM(s.visits_30d), 0)    AS v30d
      FROM ${schema.articleAnalyticsSnapshots} s
      INNER JOIN latest l
        ON s.article_slug = l.article_slug
        AND s.captured_at = l.max_ts
    `);
    const row = rows[0];
    return {
      pageviews24h: Number(row?.pv24h ?? 0),
      pageviews7d: Number(row?.pv7d ?? 0),
      pageviews30d: Number(row?.pv30d ?? 0),
      visits24h: Number(row?.v24h ?? 0),
      visits7d: Number(row?.v7d ?? 0),
      visits30d: Number(row?.v30d ?? 0),
    };
  }

  async getSiteWidePageviewHistory(days: number): Promise<SiteWidePageviewSeries> {
    const sinceUnixSec = Math.floor((Date.now() - days * 86_400_000) / 1000);

    const rows = await this.db.all<{ ts: number; pv: number }>(sql`
      SELECT
        captured_at AS ts,
        COALESCE(SUM(pageviews_24h), 0) AS pv
      FROM ${schema.articleAnalyticsSnapshots}
      WHERE captured_at >= ${sinceUnixSec}
      GROUP BY captured_at
      ORDER BY captured_at ASC
    `);

    const ts: number[] = [];
    const pv: number[] = [];
    for (const row of rows) {
      ts.push(Number(row.ts));
      pv.push(Number(row.pv));
    }
    return { ts, pv };
  }

  // ---------- Analytics (cron write) ----------

  async insertAnalyticsSnapshot(input: AnalyticsSnapshotInput): Promise<void> {
    await this.db
      .insert(schema.articleAnalyticsSnapshots)
      .values({
        articleSlug: input.slug,
        pageviews24h: input.pageviews24h,
        visits24h: input.visits24h,
        pageviews7d: input.pageviews7d,
        visits7d: input.visits7d,
        pageviews30d: input.pageviews30d,
        visits30d: input.visits30d,
        webVitalsJson: input.webVitalsJson,
        capturedAt: input.capturedAtSec,
      })
      .onConflictDoNothing();
  }

}

interface ReplyRowLike {
  id: number;
  createdAt: string;
  message: string;
  alias: string;
  parentId: number | null;
  articleSlug: string;
  moderationStatus: number;
  hidePublicity: number;
}

function rowToReply(row: ReplyRowLike): Reply {
  return {
    id: row.id,
    createdAt: new Date(row.createdAt),
    message: row.message,
    alias: row.alias,
    parentId: row.parentId,
    articleSlug: row.articleSlug,
    moderationStatus: (row.moderationStatus ??
      ModerationStatus.UNVERIFIED) as ModerationStatusType,
    hidePublicity: Boolean(row.hidePublicity),
  };
}

interface AnalyticsRowLike {
  articleSlug: string;
  pageviews24h: number;
  visits24h: number;
  pageviews7d: number;
  visits7d: number;
  pageviews30d: number;
  visits30d: number;
  webVitalsJson: string;
  capturedAt: number;
}

function rowToAnalytics(row: AnalyticsRowLike): ArticleAnalyticsRow {
  return {
    articleSlug: row.articleSlug,
    pageviews24h: Number(row.pageviews24h ?? 0),
    visits24h: Number(row.visits24h ?? 0),
    pageviews7d: Number(row.pageviews7d ?? 0),
    visits7d: Number(row.visits7d ?? 0),
    pageviews30d: Number(row.pageviews30d ?? 0),
    visits30d: Number(row.visits30d ?? 0),
    webVitals: parseWebVitals(row.webVitalsJson),
    capturedAt: new Date(Number(row.capturedAt) * 1000),
  };
}

interface AnalyticsSnapshotRow {
  id: number;
  article_slug: string;
  pageviews_24h: number;
  visits_24h: number;
  pageviews_7d: number;
  visits_7d: number;
  pageviews_30d: number;
  visits_30d: number;
  web_vitals_json: string | null;
  captured_at: number;
}

function rowToAnalyticsRaw(row: AnalyticsSnapshotRow): ArticleAnalyticsRow {
  return {
    articleSlug: row.article_slug,
    pageviews24h: Number(row.pageviews_24h ?? 0),
    visits24h: Number(row.visits_24h ?? 0),
    pageviews7d: Number(row.pageviews_7d ?? 0),
    visits7d: Number(row.visits_7d ?? 0),
    pageviews30d: Number(row.pageviews_30d ?? 0),
    visits30d: Number(row.visits_30d ?? 0),
    webVitals: parseWebVitals(row.web_vitals_json),
    capturedAt: new Date(Number(row.captured_at) * 1000),
  };
}

function parseWebVitals(
  json: string | null | undefined,
): Record<AnalyticsWindow, WebVitalGroup> {
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
