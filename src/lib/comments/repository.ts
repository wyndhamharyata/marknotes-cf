import { getTursoClient } from "../db/turso";
import { getAstroCredentials } from "../db/credentials";
import {
  ModerationStatus,
  type ModerationStatusType,
  type Reply,
  type CommentNode,
  type CreateCommentInput,
} from "./types";

export async function getCommentsBySlug(articleSlug: string): Promise<Reply[]> {
  const client = getTursoClient(getAstroCredentials());

  const result = await client.execute({
    sql: `
      SELECT id, created_at, message, alias, parent_id, article_slug,
             moderation_status, hide_publicity
      FROM replies
      WHERE article_slug = ?
        AND deleted_at IS NULL
      ORDER BY created_at DESC
    `,
    args: [articleSlug],
  });

  return result.rows.map((row) => ({
    id: row.id as number,
    createdAt: new Date(row.created_at as string),
    message: row.message as string,
    alias: row.alias as string,
    parentId: row.parent_id as number | null,
    articleSlug: row.article_slug as string,
    moderationStatus: ((row.moderation_status as number) ??
      ModerationStatus.UNVERIFIED) as ModerationStatusType,
    hidePublicity: Boolean(row.hide_publicity),
  }));
}

export async function createComment(input: CreateCommentInput): Promise<number> {
  const client = getTursoClient(getAstroCredentials());

  const result = await client.execute({
    sql: `
      INSERT INTO replies (
        created_at,
        updated_at,
        article_slug,
        message,
        alias,
        parent_id,
        hide_publicity,
        moderation_status
      ) VALUES (
        datetime('now'),
        datetime('now'),
        ?, ?, ?, ?, 0, 0
      )
    `,
    args: [input.articleSlug, input.message, input.alias, input.parentId],
  });

  return Number(result.lastInsertRowid);
}

export function buildCommentTree(comments: Reply[]): CommentNode[] {
  const commentMap = new Map<number, CommentNode>();

  for (const comment of comments) {
    commentMap.set(comment.id, { ...comment, children: [] });
  }

  const roots = comments
    .map((v) => commentMap.get(v.id))
    .filter((v) => !!v && v.parentId === null)
    .filter((v) => !!v);

  const childComments = comments
    .map((v) => commentMap.get(v.id))
    .filter((v) => !!v && v.parentId !== null)
    .filter((v) => !!v)
    // reverse order for subsequent replies, since replies makes more sense on chronological order
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  for (const comment of childComments) {
    if (!comment || !comment.parentId) continue;

    const node = commentMap.get(comment.id)!;

    const parent = commentMap.get(comment.parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export async function createCommentWithModeration(
  input: CreateCommentInput,
  moderationStatus: number
): Promise<number> {
  const client = getTursoClient(getAstroCredentials());

  const result = await client.execute({
    sql: `
      INSERT INTO replies (
        created_at,
        updated_at,
        article_slug,
        message,
        alias,
        parent_id,
        hide_publicity,
        moderation_status
      ) VALUES (
        datetime('now'),
        datetime('now'),
        ?, ?, ?, ?, 0, ?
      )
    `,
    args: [input.articleSlug, input.message, input.alias, input.parentId, moderationStatus],
  });

  return Number(result.lastInsertRowid);
}
