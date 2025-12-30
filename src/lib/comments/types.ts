export interface Reply {
  id: number;
  createdAt: Date;
  message: string;
  alias: string;
  parentId: number | null;
  articleSlug: string;
}

export interface CommentNode extends Reply {
  children: CommentNode[];
}

export interface CreateCommentInput {
  articleSlug: string;
  message: string;
  alias: string;
  parentId: number | null;
}
