import { getTursoClient } from "../db/turso";
import { getAstroCredentials } from "../db/credentials";
import {
  ModerationStatus,
  type ModerationStatusType,
  type Reply,
  type AdminComment,
  type CommentCounts,
} from "./types";

interface GetCommentsOptions {
  status?: ModerationStatusType | null;
  page?: number;
  limit?: number;
}

interface GetCommentsResult {
  comments: AdminComment[];
  total: number;
}

function mapRowToReply(row: Record<string, unknown>): Reply {
  return {
    id: row.id as number,
    createdAt: new Date(row.created_at as string),
    message: row.message as string,
    alias: row.alias as string,
    parentId: row.parent_id as number | null,
    articleSlug: row.article_slug as string,
    moderationStatus: ((row.moderation_status as number) ??
      ModerationStatus.UNVERIFIED) as ModerationStatusType,
    hidePublicity: Boolean(row.hide_publicity),
  };
}

export async function getCommentsForAdmin(
  options: GetCommentsOptions = {}
): Promise<GetCommentsResult> {
  const { status = null, page = 1, limit = 10 } = options;
  const offset = (page - 1) * limit;
  const client = getTursoClient(getAstroCredentials());

  // Build WHERE clause
  const conditions = ["r.deleted_at IS NULL", "r.hide_publicity = 0"];
  const args: (number | string)[] = [];

  if (status !== null) {
    conditions.push("r.moderation_status = ?");
    args.push(status);
  }

  const whereClause = conditions.join(" AND ");

  // Get total count
  const countResult = await client.execute({
    sql: `SELECT COUNT(*) as count FROM replies r WHERE ${whereClause}`,
    args,
  });
  const total = countResult.rows[0]?.count as number;

  // Get comments with parent info
  const result = await client.execute({
    sql: `
      SELECT
        r.id, r.created_at, r.message, r.alias, r.parent_id, r.article_slug,
        r.moderation_status, r.hide_publicity, r.moderation_reason, r.last_moderated_at,
        p.id as p_id, p.created_at as p_created_at, p.message as p_message,
        p.alias as p_alias, p.parent_id as p_parent_id, p.article_slug as p_article_slug,
        p.moderation_status as p_moderation_status, p.hide_publicity as p_hide_publicity
      FROM replies r
      LEFT JOIN replies p ON r.parent_id = p.id
      WHERE ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `,
    args: [...args, limit, offset],
  });

  // Get all comment IDs to fetch children
  const commentIds = result.rows.map((row) => row.id as number);

  // Fetch children for these comments
  const childrenMap = new Map<number, Reply[]>();
  if (commentIds.length > 0) {
    const placeholders = commentIds.map(() => "?").join(",");
    const childrenResult = await client.execute({
      sql: `
        SELECT id, created_at, message, alias, parent_id, article_slug,
               moderation_status, hide_publicity
        FROM replies
        WHERE parent_id IN (${placeholders})
          AND deleted_at IS NULL
        ORDER BY created_at ASC
      `,
      args: commentIds,
    });

    for (const row of childrenResult.rows) {
      const parentId = row.parent_id as number;
      if (!childrenMap.has(parentId)) {
        childrenMap.set(parentId, []);
      }
      childrenMap.get(parentId)!.push(mapRowToReply(row));
    }
  }

  // Map to AdminComment
  const comments: AdminComment[] = result.rows.map((row) => {
    const parent: Reply | null = row.p_id
      ? {
          id: row.p_id as number,
          createdAt: new Date(row.p_created_at as string),
          message: row.p_message as string,
          alias: row.p_alias as string,
          parentId: row.p_parent_id as number | null,
          articleSlug: row.p_article_slug as string,
          moderationStatus: ((row.p_moderation_status as number) ??
            ModerationStatus.UNVERIFIED) as ModerationStatusType,
          hidePublicity: Boolean(row.p_hide_publicity),
        }
      : null;

    return {
      ...mapRowToReply(row),
      moderationReason: (row.moderation_reason as string) || null,
      lastModeratedAt: row.last_moderated_at
        ? new Date(row.last_moderated_at as string)
        : null,
      parent,
      children: childrenMap.get(row.id as number) || [],
      articleTitle: "", // Will be populated by the caller using Astro content collection
    };
  });

  return { comments, total };
}

export async function getCommentCounts(): Promise<CommentCounts> {
  const client = getTursoClient(getAstroCredentials());

  const result = await client.execute({
    sql: `
      SELECT
        COUNT(*) as all_count,
        SUM(CASE WHEN moderation_status = 0 THEN 1 ELSE 0 END) as unverified,
        SUM(CASE WHEN moderation_status = 1 THEN 1 ELSE 0 END) as ok,
        SUM(CASE WHEN moderation_status = 2 THEN 1 ELSE 0 END) as warning,
        SUM(CASE WHEN moderation_status = 3 THEN 1 ELSE 0 END) as dangerous
      FROM replies
      WHERE deleted_at IS NULL AND hide_publicity = 0
    `,
    args: [],
  });

  const row = result.rows[0];
  return {
    all: (row?.all_count as number) || 0,
    unverified: (row?.unverified as number) || 0,
    ok: (row?.ok as number) || 0,
    warning: (row?.warning as number) || 0,
    dangerous: (row?.dangerous as number) || 0,
  };
}

export async function markCommentSafe(id: number): Promise<void> {
  const client = getTursoClient(getAstroCredentials());

  await client.execute({
    sql: `
      UPDATE replies
      SET moderation_status = ?,
          last_moderated_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [ModerationStatus.OK, id],
  });
}

export async function hideComment(id: number): Promise<void> {
  const client = getTursoClient(getAstroCredentials());

  await client.execute({
    sql: `
      UPDATE replies
      SET hide_publicity = 1,
          updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [id],
  });
}

