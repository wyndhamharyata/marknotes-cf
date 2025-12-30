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
