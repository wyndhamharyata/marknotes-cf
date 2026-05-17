import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import type { DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { alias } from "drizzle-orm/sqlite-core";
import * as schema from "../../do/schema";
import {
  ModerationStatus,
  type AdminComment,
  type CommentCounts,
  type CreateCommentInput,
  type ModerationInput,
  type ModerationResult,
  type ModerationStatusType,
  type Reply,
} from "./types";

type DB = DrizzleSqliteDODatabase<typeof schema>;

export interface GetCommentsForAdminInput {
  status: ModerationStatusType | null;
  page: number;
  limit: number;
}

// ---------- Public ----------

export async function getCommentsBySlug(db: DB, articleSlug: string): Promise<Reply[]> {
  const rows = await db
    .select()
    .from(schema.replies)
    .where(
      and(eq(schema.replies.articleSlug, articleSlug), isNull(schema.replies.deletedAt)),
    )
    .orderBy(desc(schema.replies.createdAt));

  return rows.map(rowToReply);
}

export async function createComment(db: DB, input: CreateCommentInput): Promise<number> {
  const result = await db
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

export async function createCommentWithModeration(
  db: DB,
  input: CreateCommentInput,
  moderationStatus: number,
): Promise<number> {
  const result = await db
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

// ---------- Admin ----------

export async function getCommentsForAdmin(
  db: DB,
  options: GetCommentsForAdminInput,
): Promise<{ comments: AdminComment[]; total: number }> {
  const { status, page, limit } = options;
  const offset = (page - 1) * limit;

  const baseWhere = and(
    isNull(schema.replies.deletedAt),
    eq(schema.replies.hidePublicity, 0),
    ...(status !== null ? [eq(schema.replies.moderationStatus, status)] : []),
  );

  const countRow = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.replies)
    .where(baseWhere);
  const total = Number(countRow[0]?.count ?? 0);

  const parents = alias(schema.replies, "parents");
  const commentsWithParent = await db
    .select({ comment: schema.replies, parent: parents })
    .from(schema.replies)
    .leftJoin(parents, eq(schema.replies.parentId, parents.id))
    .where(baseWhere)
    .orderBy(desc(schema.replies.createdAt))
    .limit(limit)
    .offset(offset);

  const commentIds = commentsWithParent.map((row) => row.comment.id);
  const childrenMap = new Map<number, Reply[]>();
  if (commentIds.length > 0) {
    const childrenRows = await db
      .select()
      .from(schema.replies)
      .where(
        and(inArray(schema.replies.parentId, commentIds), isNull(schema.replies.deletedAt)),
      )
      .orderBy(asc(schema.replies.createdAt));

    for (const row of childrenRows) {
      const pid = row.parentId as number;
      if (!childrenMap.has(pid)) childrenMap.set(pid, []);
      childrenMap.get(pid)!.push(rowToReply(row));
    }
  }

  const comments: AdminComment[] = commentsWithParent.map(({ comment, parent }) => ({
    ...rowToReply(comment),
    moderationReason: comment.moderationReason ?? null,
    lastModeratedAt: comment.lastModeratedAt ? new Date(comment.lastModeratedAt) : null,
    parent: parent ? rowToReply(parent) : null,
    children: childrenMap.get(comment.id) ?? [],
    articleTitle: "",
  }));

  return { comments, total };
}

export async function getCommentCounts(db: DB): Promise<CommentCounts> {
  const rows = db.all<{
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

export async function markCommentSafe(db: DB, id: number): Promise<void> {
  await db
    .update(schema.replies)
    .set({
      moderationStatus: ModerationStatus.OK,
      lastModeratedAt: sql`datetime('now')`,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(schema.replies.id, id));
}

export async function hideComment(db: DB, id: number): Promise<void> {
  await db
    .update(schema.replies)
    .set({
      hidePublicity: 1,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(schema.replies.id, id));
}

// ---------- Moderation (cron) ----------

export async function getUnmoderatedComments(
  db: DB,
  limit: number,
): Promise<ModerationInput[]> {
  const rows = await db
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

export async function updateModerationStatus(
  db: DB,
  results: ModerationResult[],
): Promise<void> {
  if (results.length === 0) return;
  for (const r of results) {
    await db
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

// ---------- File-local helpers ----------

function rowToReply(row: typeof schema.replies.$inferSelect): Reply {
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
