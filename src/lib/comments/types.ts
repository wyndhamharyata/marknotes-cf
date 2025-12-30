export interface Reply {
  id: number;
  createdAt: Date;
  message: string;
  alias: string;
  parentId: number | null;
  articleSlug: string;
  moderationStatus: number; // 0=Unverified, 1=OK, 2=Warning, 3=Dangerous
  hidePublicity: boolean;
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
