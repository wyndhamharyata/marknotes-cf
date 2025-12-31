import { getTursoClient } from "../db/turso";
import {
  ModerationStatus,
  type ModerationStatusType,
  type Reply,
  type CommentNode,
  type CreateCommentInput,
  type ModerationInput,
  type ModerationResult,
} from "./types";

export async function getCommentsBySlug(articleSlug: string): Promise<Reply[]> {
  const client = getTursoClient();

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
  const client = getTursoClient();

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
        ?,
        ?,
        ?,
        ?,
        0,
        0
      )
    `,
    args: [input.articleSlug, input.message, input.alias, input.parentId],
  });

  return Number(result.lastInsertRowid);
}

export function buildCommentTree(comments: Reply[]): CommentNode[] {
  const commentMap = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  
  for (const comment of comments) {
    commentMap.set(comment.id, { ...comment, children: [] });
  }

  
  for (const comment of comments) {
    const node = commentMap.get(comment.id)!;

    if (comment.parentId === null) {
      roots.push(node);
    } else {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        
        roots.push(node);
      }
    }
  }

  return roots;
}

export async function getUnmoderatedComments(limit: number = 50): Promise<ModerationInput[]> {
  const client = getTursoClient();

  const result = await client.execute({
    sql: `
      SELECT id, message
      FROM replies
      WHERE last_moderated_at IS NULL
        AND deleted_at IS NULL
        AND moderation_status = ?
      ORDER BY created_at ASC
      LIMIT ?
    `,
    args: [ModerationStatus.UNVERIFIED, limit],
  });

  return result.rows.map((row) => ({
    id: row.id as number,
    message: row.message as string,
  }));
}

export async function updateModerationStatus(results: ModerationResult[]): Promise<void> {
  if (results.length === 0) return;

  const client = getTursoClient();

  
  const statements = results.map((result) => ({
    sql: `
      UPDATE replies
      SET moderation_status = ?,
          moderation_reason = ?,
          last_moderated_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `,
    args: [result.moderation_status, result.moderation_reason, result.id],
  }));

  await client.batch(statements, "write");
}

export async function createCommentWithModeration(
  input: CreateCommentInput,
  moderationStatus: number
): Promise<number> {
  const client = getTursoClient();

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
        ?,
        ?,
        ?,
        ?,
        0,
        ?
      )
    `,
    args: [input.articleSlug, input.message, input.alias, input.parentId, moderationStatus],
  });

  return Number(result.lastInsertRowid);
}
