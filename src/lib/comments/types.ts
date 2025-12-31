// Moderation status constants
export const ModerationStatus = {
  UNVERIFIED: 0, // New comment awaiting AI moderation
  OK: 1, // Normal discussion, civil disagreement
  WARNING: 2, // Strong language, URLs, requires manual review
  DANGEROUS: 3, // Hate speech, spam, auto-hidden
} as const;

export type ModerationStatusType = (typeof ModerationStatus)[keyof typeof ModerationStatus];

export interface Reply {
  id: number;
  createdAt: Date;
  message: string;
  alias: string;
  parentId: number | null;
  articleSlug: string;
  moderationStatus: ModerationStatusType;
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

// Moderation types for AI processing
export interface ModerationInput {
  id: number;
  message: string;
}

export interface ModerationResult {
  id: number;
  message: string;
  moderation_status: number; // 1=OK, 2=Warning, 3=Dangerous
  moderation_reason: string;
}

export interface ModerationBatchResult {
  results: ModerationResult[];
  errors?: string[];
}
