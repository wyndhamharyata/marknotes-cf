import { getTursoClient } from "../db/turso";
import type { Reply, CommentNode, CreateCommentInput } from "./types";

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
    moderationStatus: (row.moderation_status as number) ?? 0,
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
    args: [
      input.articleSlug,
      input.message,
      input.alias,
      input.parentId,
    ],
  });

  return Number(result.lastInsertRowid);
}

export function buildCommentTree(comments: Reply[]): CommentNode[] {
  const commentMap = new Map<number, CommentNode>();
  const roots: CommentNode[] = [];

  // First pass: create all nodes
  for (const comment of comments) {
    commentMap.set(comment.id, { ...comment, children: [] });
  }

  // Second pass: build the tree
  for (const comment of comments) {
    const node = commentMap.get(comment.id)!;

    if (comment.parentId === null) {
      roots.push(node);
    } else {
      const parent = commentMap.get(comment.parentId);
      if (parent) {
        parent.children.push(node);
      } else {
        // Orphan comment (parent was deleted), treat as root
        roots.push(node);
      }
    }
  }

  return roots;
}
