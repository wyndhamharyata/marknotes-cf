export interface CommentNode {
  id: number;
  createdAt: string;
  message: string;
  alias: string;
  parentId: number | null;
  articleSlug: string;
  moderationStatus: number;
  hidePublicity: boolean;
  children: CommentNode[];
}

export interface CreateCommentResponse {
  success: true;
  comment: Omit<CommentNode, "children">;
}

export interface ErrorResponse {
  error: string;
}
