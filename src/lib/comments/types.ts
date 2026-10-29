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

// Admin moderation types
export interface AdminComment extends Reply {
  moderationReason: string | null;
  lastModeratedAt: Date | null;
  parent: Reply | null;
  children: Reply[];
  articleTitle: string;
}

export interface CommentCounts {
  all: number;
  ok: number;
  unverified: number;
  warning: number;
  dangerous: number;
}

// Helper functions for moderation UI
export function getModerationLabel(status: ModerationStatusType): string {
  switch (status) {
    case ModerationStatus.UNVERIFIED:
      return "Unmoderated";
    case ModerationStatus.OK:
      return "OK";
    case ModerationStatus.WARNING:
      return "Warning";
    case ModerationStatus.DANGEROUS:
      return "Alert";
    default:
      return "Unknown";
  }
}

// OK in ink; Warning and Alert in the author's chop red, Alert the larger stamp; Unmoderated grey.
export function getModerationStampClass(status: ModerationStatusType): string {
  switch (status) {
    case ModerationStatus.OK:
      return "stamp stamp-ink";
    case ModerationStatus.WARNING:
      return "stamp";
    case ModerationStatus.DANGEROUS:
      return "stamp stamp-lg";
    default:
      return "stamp stamp-dim";
  }
}
