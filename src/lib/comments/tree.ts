import type { CommentNode, Reply } from "./types";

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
